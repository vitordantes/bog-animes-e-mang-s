let currentTab = 'all';
let searchTimeout = null;
let scrollTimers = [];
let searchAbortController = null;
const apiCache = new Map();

let favoritos = JSON.parse(localStorage.getItem('minhaListaAnime') || '[]');
let generosMaisPesquisados = JSON.parse(localStorage.getItem('generosMaisPesquisados') || '{}');

window.addEventListener('DOMContentLoaded', inicializarHome);

function switchTab(type, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = type;
    
    document.getElementById('searchBar').value = '';
    document.getElementById('genreFilter').value = '';

    if (currentTab === 'all') {
        inicializarHome();
    } else if (currentTab === 'fav') {
        renderizarFavoritos();
    } else {
        carregarPaginaEspecifica();
    }
}

function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(executarPesquisa, 400);
}

function showToast(mensagem) {
    const toast = document.getElementById('toast');
    toast.textContent = mensagem;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 2500);
}

function toggleFavorito(itemEncoded) {
    const item = JSON.parse(decodeURIComponent(itemEncoded));
    const index = favoritos.findIndex(f => f.mal_id === item.mal_id);

    if (index > -1) {
        favoritos.splice(index, 1);
        showToast('Removido da Minha Lista');
    } else {
        favoritos.push(item);
        showToast('Adicionado à Minha Lista');
    }

    localStorage.setItem('minhaListaAnime', JSON.stringify(favoritos));
    
    if (currentTab === 'fav') renderizarFavoritos();
    else atualizarBotoesFavorito();
}

function atualizarBotoesFavorito() {
    document.querySelectorAll('.fav-btn').forEach(btn => {
        const id = parseInt(btn.getAttribute('data-id'));
        const ehFav = favoritos.some(f => f.mal_id === id);
        btn.classList.toggle('active', ehFav);
        btn.textContent = ehFav ? '★' : '☆';
    });
}

async function fetchComCache(url) {
    if (apiCache.has(url)) return apiCache.get(url);
    const res = await fetch(url);
    const data = await res.json();
    apiCache.set(url, data);
    return data;
}

function limparScrolls() {
    scrollTimers.forEach(timer => clearInterval(timer));
    scrollTimers = [];
}

function ativarAutoScroll(elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;

    let interval = setInterval(() => {
        if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 1) {
            container.scrollLeft = 0;
        } else {
            container.scrollLeft += 1;
        }
    }, 25);

    container.addEventListener('mouseenter', () => clearInterval(interval));
    container.addEventListener('mouseleave', () => {
        interval = setInterval(() => {
            if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 1) {
                container.scrollLeft = 0;
            } else {
                container.scrollLeft += 1;
            }
        }, 25);
    });

    scrollTimers.push(interval);
}

function moverCarrossel(elementId, direcao) {
    const container = document.getElementById(elementId);
    if (container) {
        container.scrollBy({ left: direcao * 240, behavior: 'smooth' });
    }
}

function gerarSkeletons(quantidade) {
    return Array(quantidade).fill('<div class="skeleton skeleton-card"></div>').join('');
}

async function inicializarHome() {
    limparScrolls();
    const main = document.getElementById('mainContainer');
    const genreId = obterGeneroMaisPesquisado();
    const nomeGenero = obterNomeGenero(genreId);

    main.innerHTML = `
        <div class="fileira-secao">
            <div class="fileira-topo">
                <div class="fileira-titulo">🔥 Fileira 1: Animes Populares</div>
                <div class="carrossel-botoes">
                    <button class="btn-nav" onclick="moverCarrossel('rowPopular', -1)">❮</button>
                    <button class="btn-nav" onclick="moverCarrossel('rowPopular', 1)">❯</button>
                </div>
            </div>
            <div class="carrossel-container" id="rowPopular">${gerarSkeletons(5)}</div>
        </div>
        <div class="fileira-secao">
            <div class="fileira-topo">
                <div class="fileira-titulo">⭐ Fileira 2: Sugestões para Você</div>
                <div class="carrossel-botoes">
                    <button class="btn-nav" onclick="moverCarrossel('rowSugestoes', -1)">❮</button>
                    <button class="btn-nav" onclick="moverCarrossel('rowSugestoes', 1)">❯</button>
                </div>
            </div>
            <div class="carrossel-container" id="rowSugestoes">${gerarSkeletons(5)}</div>
        </div>
        <div class="fileira-secao">
            <div class="fileira-topo">
                <div class="fileira-titulo">🎯 Fileira 3: Do Gênero Mais Pesquisado (${nomeGenero})</div>
                <div class="carrossel-botoes">
                    <button class="btn-nav" onclick="moverCarrossel('rowMaisPesquisado', -1)">❮</button>
                    <button class="btn-nav" onclick="moverCarrossel('rowMaisPesquisado', 1)">❯</button>
                </div>
            </div>
            <div class="carrossel-container" id="rowMaisPesquisado">${gerarSkeletons(5)}</div>
        </div>
    `;

    await carregarCarrossel('https://api.jikan.moe/v4/top/anime?limit=12', 'rowPopular');
    await new Promise(r => setTimeout(r, 800));
    await carregarCarrossel('https://api.jikan.moe/v4/seasons/now?limit=12', 'rowSugestoes');
    await new Promise(r => setTimeout(r, 800));
    await carregarCarrossel(`https://api.jikan.moe/v4/anime?genres=${genreId}&limit=12`, 'rowMaisPesquisado');
}

async function carregarCarrossel(url, elementId) {
    const container = document.getElementById(elementId);
    try {
        const json = await fetchComCache(url);
        if (json.data && json.data.length > 0) {
            container.innerHTML = json.data.map(item => criarCardHTML(item)).join('');
            ativarAutoScroll(elementId);
        } else {
            container.innerHTML = `<p style="color:var(--texto-cinza); font-size:12px;">Nenhum item disponível.</p>`;
        }
    } catch (err) {
        container.innerHTML = `<p style="color:var(--texto-cinza); font-size:12px;">Erro ao carregar.</p>`;
    }
}

async function carregarPaginaEspecifica() {
    limparScrolls();
    const main = document.getElementById('mainContainer');
    const ehAnime = currentTab === 'anime';
    const tituloArea = ehAnime ? '📺 Catalogados para Assistir (Animes)' : '📖 Catalogados para Ler (Mangás)';
    
    main.innerHTML = `
        <div class="fileira-titulo" style="margin-bottom:16px;">${tituloArea}</div>
        <div class="grid-pesquisa" id="gridEspecífica">${gerarSkeletons(12)}</div>
    `;

    const endpoint = ehAnime 
        ? 'https://api.jikan.moe/v4/top/anime?limit=24' 
        : 'https://api.jikan.moe/v4/top/manga?limit=24';

    try {
        const json = await fetchComCache(endpoint);
        document.getElementById('gridEspecífica').innerHTML = json.data.map(item => criarCardHTML(item, ehAnime ? 'anime' : 'manga')).join('');
    } catch (err) {
        document.getElementById('gridEspecífica').innerHTML = `<p style="grid-column: 1/-1; color: var(--texto-cinza); text-align: center;">Erro ao carregar dados.</p>`;
    }
}

function renderizarFavoritos() {
    limparScrolls();
    const main = document.getElementById('mainContainer');
    main.innerHTML = `
        <div class="fileira-titulo" style="margin-bottom:16px;">⭐ Minha Lista de Favoritos</div>
        <div class="grid-pesquisa" id="gridFav"></div>
    `;

    const grid = document.getElementById('gridFav');
    if (favoritos.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; color: var(--texto-cinza); text-align: center; padding: 20px;">Você ainda não adicionou nenhum título à sua lista.</p>`;
        return;
    }

    grid.innerHTML = favoritos.map(item => criarCardHTML(item)).join('');
}

async function executarPesquisa() {
    limparScrolls();
    const query = document.getElementById('searchBar').value.trim();
    const genre = document.getElementById('genreFilter').value;
    const main = document.getElementById('mainContainer');

    if (!query && !genre) {
        if (currentTab === 'all') inicializarHome();
        else if (currentTab === 'fav') renderizarFavoritos();
        else carregarPaginaEspecifica();
        return;
    }

    if (genre) {
        generosMaisPesquisados[genre] = (generosMaisPesquisados[genre] || 0) + 1;
        localStorage.setItem('generosMaisPesquisados', JSON.stringify(generosMaisPesquisados));
    }

    if (searchAbortController) searchAbortController.abort();
    searchAbortController = new AbortController();

    main.innerHTML = `
        <div class="fileira-titulo" style="margin-bottom:16px;">🔍 Resultados Encontrados</div>
        <div class="grid-pesquisa" id="gridPesquisa">${gerarSkeletons(12)}</div>
    `;

    const rota = currentTab === 'manga' ? 'manga' : 'anime';
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (genre) params.append('genres', genre);
    if (currentTab !== 'all' && currentTab !== 'manga') params.append('type', currentTab);
    params.append('limit', '24');

    try {
        const res = await fetch(`https://api.jikan.moe/v4/${rota}?${params.toString()}`, { signal: searchAbortController.signal });
        const json = await res.json();

        const grid = document.getElementById('gridPesquisa');
        if (!json.data || json.data.length === 0) {
            grid.innerHTML = `<p style="grid-column: 1/-1; color: var(--texto-cinza); text-align: center; padding: 20px;">Nenhum item encontrado.</p>`;
            return;
        }

        grid.innerHTML = json.data.map(item => criarCardHTML(item)).join('');
    } catch (err) {
        if (err.name !== 'AbortError') {
            document.getElementById('gridPesquisa').innerHTML = `<p style="grid-column: 1/-1; color: var(--texto-cinza); text-align: center;">Erro na busca.</p>`;
        }
    }
}

function criarCardHTML(item, forcarTipo = null) {
    const autor = item.studios?.[0]?.name || item.authors?.[0]?.name || 'Autor / Estúdio';
    const imagem = item.images?.jpg?.large_image_url || item.images?.jpg?.image_url;
    
    let tipo = forcarTipo;
    if (!tipo) {
        tipo = item.type?.toLowerCase().includes('manga') ? 'manga' : 'anime';
    }

    const ehFav = favoritos.some(f => f.mal_id === item.mal_id);
    const itemDataEncoded = encodeURIComponent(JSON.stringify(item));

    return `
        <article>
            <button class="fav-btn ${ehFav ? 'active' : ''}" data-id="${item.mal_id}" onclick="toggleFavorito('${itemDataEncoded}')">
                ${ehFav ? '★' : '☆'}
            </button>
            <img src="${imagem}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/220x240?text=Sem+Imagem'">
            <div class="artigo-info">
                <div>
                    <span class="artigo-autor">${autor}</span>
                    <h3 title="${item.title}">${item.title}</h3>
                    <p>${item.synopsis || 'Sem sinopse disponível.'}</p>
                </div>
                <button class="btn-read" onclick="abrirCapitulos('${itemDataEncoded}')">
                    ${tipo === 'anime' ? '📺 Assistir' : '📖 Ler'}
                </button>
            </div>
        </article>
    `;
}

function abrirCapitulos(itemEncoded) {
    const item = JSON.parse(decodeURIComponent(itemEncoded));
    const modal = document.getElementById('modalCapitulos');
    const tipo = item.type?.toLowerCase().includes('manga') ? 'manga' : 'anime';
    
    document.getElementById('modalTitulo').textContent = item.title;
    const capitulosGrid = document.getElementById('capitulosGrid');
    const trailerArea = document.getElementById('trailerArea');
    capitulosGrid.innerHTML = '';
    voltarParaLista();

    if (item.trailer?.embed_url) {
        trailerArea.innerHTML = `<iframe src="${item.trailer.embed_url}" frameborder="0" allowfullscreen></iframe>`;
    } else {
        trailerArea.innerHTML = '';
    }

    const total = tipo === 'anime' ? 12 : 20;
    const rotulo = tipo === 'anime' ? 'Episódio' : 'Capítulo';

    for (let i = 1; i <= total; i++) {
        const btn = document.createElement('button');
        btn.className = 'capitulo-btn';
        btn.textContent = `${rotulo} ${i}`;
        btn.onclick = () => carregarConteudo(item.title, tipo, i);
        capitulosGrid.appendChild(btn);
    }

    modal.style.display = 'flex';
}

function carregarConteudo(titulo, tipo, numero) {
    document.getElementById('listaCapitulosArea').style.display = 'none';
    document.getElementById('trailerArea').style.display = 'none';
    
    const viewer = document.getElementById('viewerContainer');
    const viewerTitle = document.getElementById('viewerTitle');
    const viewerContent = document.getElementById('viewerContent');

    viewer.style.display = 'flex';
    viewerTitle.textContent = `${titulo} - ${tipo === 'anime' ? 'Episódio' : 'Capítulo'} ${numero}`;

    if (tipo === 'manga') {
        viewerContent.innerHTML = `
            <p style="font-size:11px; color:var(--texto-cinza);">Página 1 de 1</p>
            <div style="background:#fff; color:#000; padding:40px; font-weight:bold; border-radius:6px; text-align:center;">
                📖 Modo de Leitura - Capítulo ${numero}
            </div>
        `;
    } else {
        viewerContent.innerHTML = `
            <div style="width:100%; aspect-ratio:16/9; background:#050505; border-radius:8px; display:flex; align-items:center; justify-content:center; border:2px solid var(--amarelo-destaque);">
                <div style="text-align:center;">
                    <p style="font-size:36px; margin-bottom:8px;">▶️</p>
                    <p style="font-size:13px; font-weight:bold; color:var(--amarelo-destaque);">Reproduzindo ${titulo} - Ep. ${numero}</p>
                </div>
            </div>
        `;
    }
}

function voltarParaLista() {
    document.getElementById('listaCapitulosArea').style.display = 'block';
    document.getElementById('trailerArea').style.display = 'block';
    document.getElementById('viewerContainer').style.display = 'none';
}

function fecharModal() {
    document.getElementById('modalCapitulos').style.display = 'none';
}

function obterGeneroMaisPesquisado() {
    let maxKey = '1';
    let maxVal = -1;
    for (const [key, val] of Object.entries(generosMaisPesquisados)) {
        if (val > maxVal) {
            maxVal = val;
            maxKey = key;
        }
    }
    return maxKey;
}

function obterNomeGenero(id) {
    const generos = {
        '1': 'Ação', '2': 'Aventura', '4': 'Comédia', '8': 'Drama',
        '10': 'Fantasia', '14': 'Horror', '22': 'Romance', '24': 'Ficção Científica'
    };
    return generos[id] || 'Ação';
}

window.onclick = function(e) {
    if (e.target === document.getElementById('modalCapitulos')) fecharModal();
}