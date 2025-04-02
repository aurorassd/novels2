// グローバルスコープでデフォルト/フォールバック用のトーンリストを定義
let availableTones = ['なし', 'シリアス', 'コミカル', 'アダルト', '緊迫', '穏やか'];

// DOMContentLoaded イベントリスナーを async にして await を使えるようにする
document.addEventListener('DOMContentLoaded', async () => {
    const MAX_NOVELS = 10;
    const STORAGE_KEY = 'aiNovelAssistantData_v1';

    // --- DOM Elements ---
    const menuButton = document.getElementById('menu-button');
    const novelMenu = document.getElementById('novel-menu');
    const novelListElement = document.getElementById('novel-list');
    const createNewNovelButton = document.getElementById('create-new-novel-button');
    const novelListMainSection = document.getElementById('novel-list-main');
    const mainNovelListUl = document.getElementById('main-novel-list-ul');
    const noNovelsMessage = document.getElementById('no-novels-message');
    const novelDetailsElement = document.getElementById('novel-details');
    const novelTitleInput = document.getElementById('novel-title');
    const novelSettingTextarea = document.getElementById('novel-setting');
    const novelCharactersTextarea = document.getElementById('novel-characters');
    const combinedNovelPromptTextarea = document.getElementById('combined-novel-prompt');
    const copyCombinedNovelPromptButton = document.getElementById('copy-combined-novel-prompt');
    const deleteNovelButton = document.getElementById('delete-novel-button');
    const addSubtitleButton = document.getElementById('add-subtitle-button');
    const subtitleListContainer = document.getElementById('subtitle-list');
    const subtitleTemplate = document.getElementById('subtitle-template');

    // --- Application State ---
    let novels = [];
    let currentNovelIndex = null;

    // --- トーンファイルを読み込む関数 ---
    async function loadTonesFromFile() {
        try {
            const response = await fetch('./tones.txt'); // 同じ階層の tones.txt を取得試行
            if (!response.ok) { // fetch自体は成功したが、ステータスがエラー(404 Not Foundなど)
                if (response.status === 404) {
                    console.warn('tones.txt not found. Using default tones.');
                } else {
                    // 404以外のエラー
                    throw new Error(`HTTP error loading tones.txt: ${response.status} ${response.statusText}`);
                }
                return; // 404や他のエラーでもデフォルト値を使うのでここで終了
            }
            const text = await response.text();
            const lines = text.split(/\r?\n/) // 改行コード(\r\n, \n)で分割
                             .map(line => line.trim()) // 前後の空白除去
                             .filter(line => line.length > 0); // 空行を除去

            if (lines.length > 0) {
                availableTones = lines; // 読み込んだ内容でグローバル変数を上書き
                console.log('Tones loaded from file:', availableTones);
            } else {
                console.warn('tones.txt is empty. Using default tones.');
            }
        } catch (error) { // fetch 自体が失敗した場合 (ネットワークエラーなど)
            console.error('Failed to fetch tones.txt. Using default tones.', error);
            // エラーが発生しても処理は続行し、デフォルトのトーンリストが使われる
        }
    }

    // --- Initialization ---
    await loadTonesFromFile(); // ★ トーンファイルを先に読み込む
    loadData();
    renderNovelList();
    setupInitialView();
    addGlobalEventListeners();

    // --- Data Handling ---
    function saveData() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(novels)); }
        catch (e) { console.error("Error saving data to localStorage:", e); alert("データの保存に失敗しました。ストレージの空き容量を確認してください。"); }
    }
    function loadData() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            try { novels = JSON.parse(data); if (!Array.isArray(novels)) novels = []; }
            catch (e) { console.error("Error parsing data from localStorage:", e); novels = []; alert("保存されたデータの読み込みに失敗しました。データがリセットされます。"); localStorage.removeItem(STORAGE_KEY); }
        } else { novels = []; }
        if (novels.length > MAX_NOVELS) { novels = novels.slice(0, MAX_NOVELS); saveData(); }
    }

    // --- UI Rendering ---
    function renderNovelList() { // サイドメニューリスト
        novelListElement.innerHTML = '';
        if (novels.length === 0) { novelListElement.innerHTML = '<li>まだ小説がありません</li>'; }
        else {
            novels.forEach((novel, index) => {
                const li = document.createElement('li');
                li.textContent = novel.title || `無題 ${index + 1}`;
                li.dataset.index = index;
                if (index === currentNovelIndex) li.classList.add('active');
                li.addEventListener('click', () => { switchNovel(index); closeMenu(); });
                novelListElement.appendChild(li);
            });
        }
        createNewNovelButton.disabled = novels.length >= MAX_NOVELS;
        createNewNovelButton.title = novels.length >= MAX_NOVELS ? `小説は最大${MAX_NOVELS}件までです` : '新しい小説を作成します';
    }
    function renderMainNovelList() { // メインエリアリスト
        mainNovelListUl.innerHTML = '';
        if (novels.length > 0) {
            novelListMainSection.classList.remove('hidden'); noNovelsMessage.classList.add('hidden'); mainNovelListUl.classList.remove('hidden');
            novels.forEach((novel, index) => {
                const li = document.createElement('li');
                li.textContent = novel.title || `無題 ${index + 1}`;
                li.dataset.index = index;
                li.addEventListener('click', () => switchNovel(index));
                mainNovelListUl.appendChild(li);
            });
        } else {
            novelListMainSection.classList.remove('hidden'); mainNovelListUl.classList.add('hidden'); noNovelsMessage.classList.remove('hidden');
        }
    }
    function setupInitialView() { // 初期表示切替
        if (currentNovelIndex !== null && novels[currentNovelIndex]) {
            novelListMainSection.classList.add('hidden'); addSubtitleButton.style.display = 'block'; // ★ ボタン表示
            renderNovelDetails(currentNovelIndex);
        } else {
            novelDetailsElement.classList.add('hidden'); addSubtitleButton.style.display = 'none'; // ★ ボタン非表示
            renderMainNovelList();
        }
        closeMenu();
    }
    function renderNovelDetails(index) { // 小説詳細表示
        if (index < 0 || index >= novels.length) { currentNovelIndex = null; setupInitialView(); return; }
        currentNovelIndex = index; const novel = novels[index];
        novelListMainSection.classList.add('hidden'); novelDetailsElement.classList.remove('hidden'); addSubtitleButton.style.display = 'block';
        novelTitleInput.value = novel.title || ''; novelSettingTextarea.value = novel.setting || ''; novelCharactersTextarea.value = novel.characters || '';
        updateCombinedNovelPrompt();
        subtitleListContainer.innerHTML = '';
        if (novel.subtitles && Array.isArray(novel.subtitles)) { novel.subtitles.forEach((sub, idx) => addSubtitleElement(sub, idx)); }
        else { novel.subtitles = []; }
        renderNovelList();
    }
    function addSubtitleElement(subtitleData, subtitleIndex) { // サブタイトル要素追加
        const clone = subtitleTemplate.content.cloneNode(true); const entry = clone.querySelector('.subtitle-entry'); entry.dataset.subtitleIndex = subtitleIndex;
        const toggleBtn = entry.querySelector('.toggle-button'); const subInput = entry.querySelector('.subtitle-input'); const epSelect = entry.querySelector('.episode-select'); const lenSelect = entry.querySelector('.length-select'); const t1Select = entry.querySelector('.tone1-select'); const t2Select = entry.querySelector('.tone2-select'); const t3Select = entry.querySelector('.tone3-select'); const plotArea = entry.querySelector('.plot-textarea'); const notesArea = entry.querySelector('.notes-textarea'); const promptOut = entry.querySelector('.subtitle-prompt-output'); const copyBtn = entry.querySelector('.copy-subtitle-prompt-button'); const delBtn = entry.querySelector('.delete-subtitle-button');

        // 値設定
        subInput.value = subtitleData.subtitle || ''; lenSelect.value = subtitleData.length || '中尺'; plotArea.value = subtitleData.plot || ''; notesArea.value = subtitleData.notes || '';

        // トーン選択肢生成と選択
        [t1Select, t2Select, t3Select].forEach(select => { select.innerHTML = ''; availableTones.forEach(tone => { const opt = document.createElement('option'); opt.value = opt.textContent = tone; select.appendChild(opt); }); });
        t1Select.value = availableTones.includes(subtitleData.tone1) ? subtitleData.tone1 : availableTones[0] || 'なし'; t2Select.value = availableTones.includes(subtitleData.tone2) ? subtitleData.tone2 : availableTones[0] || 'なし'; t3Select.value = availableTones.includes(subtitleData.tone3) ? subtitleData.tone3 : availableTones[0] || 'なし';

        populateEpisodeSelect(epSelect, subtitleData.episode); updateSubtitleToggleButtonText(toggleBtn, subtitleData.subtitle, subtitleData.episode);

        // イベントリスナー
        const elementsToWatch = [subInput, epSelect, lenSelect, t1Select, t2Select, t3Select, plotArea, notesArea];
        elementsToWatch.forEach(el => { const eventType = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? 'input' : 'change'; el.addEventListener(eventType, handleSubtitleInputChange); });
        copyBtn.addEventListener('click', () => copyToClipboard(promptOut.value, copyBtn)); delBtn.addEventListener('click', () => { if (confirm(`「${subtitleData.subtitle || '無題'}」(第${subtitleData.episode}話) を削除しますか？`)) { deleteSubtitle(subtitleIndex); } });

        // 初期化・追加
        addCollapsibleFunctionality(entry); updateSubtitlePromptOutput(entry, subtitleIndex); subtitleListContainer.appendChild(entry);
    }
    function populateEpisodeSelect(selectElement, selectedEpisode) { // 話数プルダウン生成
        selectElement.innerHTML = ''; const maxEpisodes = 99;
        for (let i = 1; i <= maxEpisodes; i++) { const opt = document.createElement('option'); opt.value = i; opt.textContent = `${i}話`; selectElement.appendChild(opt); }
        selectElement.value = (selectedEpisode >= 1 && selectedEpisode <= maxEpisodes) ? selectedEpisode : 1;
    }

    // --- Event Handlers ---
    function handleMenuToggle() { novelMenu.classList.toggle('visible'); }
    function closeMenu() { novelMenu.classList.remove('visible'); }
    function handleCreateNewNovel() { // 新規小説作成
        if (novels.length >= MAX_NOVELS) { alert(`小説は最大${MAX_NOVELS}件まで作成できます。`); return; }
        const newNovel = { title: `新しい小説 ${novels.length + 1}`, setting: '', characters: '', subtitles: [] };
        novels.push(newNovel); currentNovelIndex = novels.length - 1; saveData(); renderNovelList(); setupInitialView(); novelTitleInput.focus();
        openCollapsible(document.querySelector('#novel-setup .collapsible-section:nth-child(1)')); openCollapsible(document.querySelector('#novel-setup .collapsible-section:nth-child(2)')); openCollapsible(document.querySelector('#novel-setup .collapsible-section:nth-child(3)'));
    }
    function handleDeleteNovel() { // 小説削除
        if (currentNovelIndex === null || !novels[currentNovelIndex]) return;
        const title = novels[currentNovelIndex].title || `無題の小説 ${currentNovelIndex + 1}`;
        if (confirm(`小説「${title}」を完全に削除しますか？この操作は元に戻せません。`)) {
            novels.splice(currentNovelIndex, 1); currentNovelIndex = null; saveData(); renderNovelList(); setupInitialView();
        }
    }
    function switchNovel(index) { // 小説切替
        if (index >= 0 && index < novels.length) { currentNovelIndex = index; } else { currentNovelIndex = null; }
        setupInitialView(); closeMenu();
    }
    function handleNovelInputChange(event) { // 基本設定入力
        if (currentNovelIndex === null) return; const novel = novels[currentNovelIndex]; const { id, value } = event.target;
        if (id === 'novel-title') { novel.title = value; renderNovelList(); } else if (id === 'novel-setting') novel.setting = value; else if (id === 'novel-characters') novel.characters = value;
        updateCombinedNovelPrompt(); saveData();
    }
    function handleAddSubtitle() { // サブタイトル追加
        if (currentNovelIndex === null) return; const novel = novels[currentNovelIndex];
        let nextEpisode = 1; // デフォルト話数決定
        if (novel.subtitles && novel.subtitles.length > 0) { const maxEp = novel.subtitles.reduce((max, sub) => { const ep = parseInt(sub.episode, 10); return (!isNaN(ep) && ep > max) ? ep : max; }, 0); nextEpisode = maxEp + 1; }
        const newSub = { subtitle: '', episode: nextEpisode, length: '中尺', tone1: availableTones[0] || 'なし', tone2: availableTones[0] || 'なし', tone3: availableTones[0] || 'なし', plot: '', notes: '' };
        novel.subtitles.push(newSub); addSubtitleElement(newSub, novel.subtitles.length - 1); saveData();
        const newElement = subtitleListContainer.lastElementChild; if (newElement) { newElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); openCollapsible(newElement); }
    }
    function handleSubtitleInputChange(event) { // サブタイトル入力
        if (currentNovelIndex === null) return; const target = event.target; const entry = target.closest('.subtitle-entry'); if (!entry) return; const index = parseInt(entry.dataset.subtitleIndex, 10); if (isNaN(index) || !novels[currentNovelIndex]?.subtitles?.[index]) return; const subtitle = novels[currentNovelIndex].subtitles[index]; const { value } = target; const toggleBtn = entry.querySelector('.toggle-button');
        if (target.classList.contains('subtitle-input')) { subtitle.subtitle = value; updateSubtitleToggleButtonText(toggleBtn, value, subtitle.episode); }
        else if (target.classList.contains('episode-select')) { subtitle.episode = parseInt(value, 10) || 1; updateSubtitleToggleButtonText(toggleBtn, subtitle.subtitle, subtitle.episode); }
        else if (target.classList.contains('length-select')) subtitle.length = value; else if (target.classList.contains('tone1-select')) subtitle.tone1 = value; else if (target.classList.contains('tone2-select')) subtitle.tone2 = value; else if (target.classList.contains('tone3-select')) subtitle.tone3 = value; else if (target.classList.contains('plot-textarea')) subtitle.plot = value; else if (target.classList.contains('notes-textarea')) subtitle.notes = value;
        updateSubtitlePromptOutput(entry, index); saveData(); // ★ 更新と保存
    }
    function deleteSubtitle(subtitleIndex) { // サブタイトル削除
        if (currentNovelIndex === null) return; const novel = novels[currentNovelIndex]; if (subtitleIndex < 0 || subtitleIndex >= novel.subtitles.length) return;
        novel.subtitles.splice(subtitleIndex, 1); saveData(); renderNovelDetails(currentNovelIndex); // 再描画
    }

    // --- Prompt Generation ---
    function generateCombinedNovelPrompt(novel) { return `\n# タイトル\n${novel.title || '（未設定）'}\n\n# 舞台設定\n${novel.setting || '（未設定）'}\n\n# キャラクター設定\n${novel.characters || '（未設定）'}\n`.trim(); }
    function generateSubtitlePrompt(subtitle) { return `\n# サブタイトル: ${subtitle.subtitle || '（未設定）'}\n# 話数: 第${subtitle.episode || '?'}話\n# 長さ: ${subtitle.length || '（未設定）'}\n# トーン1(高): ${subtitle.tone1 || 'なし'}\n# トーン2(中): ${subtitle.tone2 || 'なし'}\n# トーン3(低): ${subtitle.tone3 || 'なし'}\n\n# プロット\n${subtitle.plot || '※ここからプロットスタート'}\n\n# 特記事項\n${subtitle.notes || '※ここから特記事項スタート'}\n`.trim(); }
    function updateCombinedNovelPrompt() { combinedNovelPromptTextarea.value = (currentNovelIndex !== null && novels[currentNovelIndex]) ? generateCombinedNovelPrompt(novels[currentNovelIndex]) : ''; }
    function updateSubtitlePromptOutput(element, index) { const output = element.querySelector('.subtitle-prompt-output'); if (output && currentNovelIndex !== null && novels[currentNovelIndex]?.subtitles[index]) output.value = generateSubtitlePrompt(novels[currentNovelIndex].subtitles[index]); }
    function updateSubtitleToggleButtonText(button, text, episode) { button.textContent = `▼ ${episode || '?'}話: ${text || 'サブタイトル未入力'}`; }

    // --- Utility Functions ---
    function copyToClipboard(text, button) { navigator.clipboard?.writeText(text).then(() => { if(button){ const orig = button.textContent, origBg = button.style.backgroundColor; button.textContent = 'コピー!'; button.style.backgroundColor = '#28a745'; setTimeout(() => {button.textContent = orig; button.style.backgroundColor = origBg;}, 1500);} }).catch(err => {console.error('Copy failed:', err); alert('コピーに失敗しました。');}); }
    async function pasteFromClipboard(target) { try { const text = await navigator.clipboard?.readText(); if(text === undefined) throw new Error('Clipboard API not supported or permission denied'); const start = target.selectionStart, end = target.selectionEnd; target.value = target.value.substring(0, start) + text + target.value.substring(end); target.selectionStart = target.selectionEnd = start + text.length; target.focus(); target.dispatchEvent(new Event('input',{bubbles:true})); target.dispatchEvent(new Event('change',{bubbles:true})); } catch(err){ console.error('Paste failed:', err); alert('ペーストに失敗しました。権限を確認してください。'); } }
    function addCollapsibleFunctionality(section) { const btn = section.querySelector('.toggle-button'); const content = section.querySelector('.collapsible-content'); if (btn && content) { btn.addEventListener('click', () => { const isCollapsed = content.classList.toggle('collapsed'); btn.textContent = isCollapsed ? btn.textContent.replace('▼', '▶') : btn.textContent.replace('▶', '▼'); }); if (!content.classList.contains('initially-open') && !content.classList.contains('collapsed')) { content.classList.add('collapsed'); btn.textContent = btn.textContent.replace('▼', '▶'); } else if (content.classList.contains('initially-open') && content.classList.contains('collapsed')) { content.classList.remove('collapsed'); btn.textContent = btn.textContent.replace('▶', '▼'); } } }
    function openCollapsible(section) { const btn = section.querySelector('.toggle-button'); const content = section.querySelector('.collapsible-content'); if (btn && content?.classList.contains('collapsed')) { content.classList.remove('collapsed'); btn.textContent = btn.textContent.replace('▶', '▼'); } }

    // --- Global Event Listeners Setup ---
    function addGlobalEventListeners() {
        menuButton.addEventListener('click', handleMenuToggle); createNewNovelButton.addEventListener('click', handleCreateNewNovel);
        deleteNovelButton.addEventListener('click', handleDeleteNovel); novelTitleInput.addEventListener('input', handleNovelInputChange);
        novelSettingTextarea.addEventListener('input', handleNovelInputChange); novelCharactersTextarea.addEventListener('input', handleNovelInputChange);
        copyCombinedNovelPromptButton.addEventListener('click', () => copyToClipboard(combinedNovelPromptTextarea.value, copyCombinedNovelPromptButton));
        addSubtitleButton.addEventListener('click', handleAddSubtitle);
        document.querySelectorAll('#novel-setup .collapsible-section').forEach(addCollapsibleFunctionality); // 基本設定の折りたたみを初期化
        // イベント委任でコピー/ペーストボタン処理
        document.body.addEventListener('click', async (e) => {
            const t = e.target;
            if (t.matches('.copy-btn[data-target]')) { const el = document.getElementById(t.dataset.target); if (el) copyToClipboard(el.value, t); }
            else if (t.matches('.copy-btn[data-target-class]')) { const c = t.closest('.collapsible-content')?.querySelector(`.${t.dataset.targetClass}`); if (c) copyToClipboard(c.value, t); }
            else if (t.matches('.paste-btn[data-target]')) { const el = document.getElementById(t.dataset.target); if (el) await pasteFromClipboard(el); }
            else if (t.matches('.paste-btn[data-target-class]')) { const c = t.closest('.collapsible-content')?.querySelector(`.${t.dataset.targetClass}`); if (c) await pasteFromClipboard(c); }
            else if (t.matches('.copy-subtitle-prompt-button')) { const p = t.closest('.collapsible-content')?.querySelector('.subtitle-prompt-output'); if (p) copyToClipboard(p.value, t); }
        });
        // メニュー外クリックで閉じる
        document.addEventListener('click', (e) => { if (!novelMenu.contains(e.target) && !menuButton.contains(e.target) && novelMenu.classList.contains('visible')) closeMenu(); });
    }

}); // End DOMContentLoaded