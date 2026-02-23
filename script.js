document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Toggle Logic ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggleBtn.textContent = '☀️';
    } else if (currentTheme === null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-mode');
        themeToggleBtn.textContent = '☀️';
    }

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            themeToggleBtn.textContent = '☀️';
        } else {
            localStorage.setItem('theme', 'light');
            themeToggleBtn.textContent = '🌙';
        }
    });
    // --------------------------

    const formatBtn = document.getElementById('format-btn');
    const printBtn = document.getElementById('print-btn');
    const textInput = document.getElementById('text-input');
    const printArea = document.getElementById('print-area');

    formatBtn.addEventListener('click', () => {
        const text = textInput.value;

        if (!text) {
            alert('テキストを入力してください。');
            return;
        }

        generateGenkouyoushi(text);
        printBtn.disabled = false;

        // スクロールしてプレビュー領域を表示
        printArea.scrollIntoView({ behavior: 'smooth' });
    });

    printBtn.addEventListener('click', () => {
        window.print();
    });

    function generateGenkouyoushi(text) {
        printArea.innerHTML = ''; // クリア

        const characters = processText(text);

        // 400文字（20文字×20行）ごとに分割してページを作成
        const charsPerPage = 400;
        // 文字がゼロでも最低1ページは作成
        const totalPages = Math.max(1, Math.ceil(characters.length / charsPerPage));

        for (let i = 0; i < totalPages; i++) {
            const startIdx = i * charsPerPage;
            const endIdx = startIdx + charsPerPage;
            const pageChars = characters.slice(startIdx, endIdx);

            const pageEl = createPage(pageChars);
            printArea.appendChild(pageEl);
        }
    }

    function processText(text) {
        const characters = [];

        const tokens = tokenize(text);
        let isNewParagraph = true;

        // --- 本文処理 ---
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (token.type === 'newline') {
                // 行の残りを空白で埋める
                if (characters.length % 20 !== 0) {
                    const remainder = 20 - (characters.length % 20);
                    for (let j = 0; j < remainder; j++) characters.push(null);
                }
                isNewParagraph = true;
                continue;
            }

            if (isNewParagraph) {
                // 段落冒頭は1マス空ける
                if (token.type === 'char' && (token.value === ' ' || token.value === '　')) {
                    characters.push('　');
                    isNewParagraph = false;
                    continue; // 既存のスペースを消費
                } else {
                    characters.push('　'); // 強制的にスペース挿入
                }
                isNewParagraph = false;
            }

            let currentPos = characters.length % 20;
            let availableSpace = 20 - currentPos;

            const kinsokuHead = /^[、。，．？！）」』\]｝〉》】〕％%℃ー]$/;
            const kinsokuTail = /^[「（『【]$/;

            if (token.type === 'english' || token.type === 'number') {
                const wordLen = token.value.length;
                let nextToken = (i + 1 < tokens.length) ? tokens[i + 1] : null;

                // ぴったり行末に収まるが、次の文字が行頭禁則文字の場合 -> まるごと次行へ送る
                if (wordLen === availableSpace && nextToken && nextToken.type === 'char' && kinsokuHead.test(nextToken.value)) {
                    for (let j = 0; j < availableSpace; j++) characters.push(null);
                    for (let j = 0; j < wordLen; j++) characters.push(token.value[j]);
                    continue; // nextTokenは次のループで処理される（新しい行の2文字目以降になるので禁則を回避できる）
                }

                // 英単語・数値が途中で見切れる場合 -> まるごと次行へ送る
                if (wordLen > availableSpace && availableSpace < 20) {
                    if (wordLen <= 20) {
                        for (let j = 0; j < availableSpace; j++) characters.push(null);
                        for (let j = 0; j < wordLen; j++) characters.push(token.value[j]);
                    } else {
                        // 20文字以上の超長単語は諦めて分割する（異常系）
                        for (let j = 0; j < wordLen; j++) characters.push(token.value[j]);
                    }
                } else {
                    for (let j = 0; j < wordLen; j++) characters.push(token.value[j]);
                }

            } else if (token.type === 'char') {
                // 行末禁則処理 (開き記号が最後に来る場合) -> 次行へ送る
                if (currentPos === 19 && kinsokuTail.test(token.value)) {
                    characters.push(null);
                    characters.push(token.value);
                    continue;
                }

                // 行頭禁則処理のための先読み (次の文字が行頭禁則記号なら、今の文字ごと次行へ送る)
                if (currentPos === 19) {
                    let nextToken = (i + 1 < tokens.length) ? tokens[i + 1] : null;
                    if (nextToken && nextToken.type === 'char' && kinsokuHead.test(nextToken.value)) {
                        characters.push(null); // 現在のマスを空白に
                        characters.push(token.value); // 今の文字を次行の先頭へ
                        continue; // nextTokenは次のループで次行の2文字目として安全に配置される
                    }
                }

                characters.push(token.value);
            }
        }

        return characters;
    }

    // 意味のある塊（単語・機能・文字）に分割するトークナイザー
    function tokenize(text) {
        const tokens = [];
        let i = 0;
        while (i < text.length) {
            const char = text[i];

            if (char === '\n' || char === '\r') {
                if (char === '\n') tokens.push({ type: 'newline', value: '\n' });
                i++;
                continue;
            }

            // 英文字の連続（全角・半角）
            const engMatch = text.slice(i).match(/^[A-Za-zＡ-Ｚａ-ｚ]+/);
            if (engMatch) {
                tokens.push({ type: 'english', value: engMatch[0] });
                i += engMatch[0].length;
                continue;
            }

            // 数値と単位の連続（全角・半角）
            const numMatch = text.slice(i).match(/^[0-9０-９]+([.．][0-9０-９]+)?([％%℃]|ミリ|センチ|メートル|グラム|キロ)?/);
            if (numMatch) {
                tokens.push({ type: 'number', value: numMatch[0] });
                i += numMatch[0].length;
                continue;
            }

            tokens.push({ type: 'char', value: char });
            i++;
        }
        return tokens;
    }

    function createPage(characters) {
        const pageTemplate = document.createElement('div');
        pageTemplate.className = 'genkouyoushi-page';

        const containerEl = document.createElement('div');
        containerEl.className = 'genkouyoushi-container';

        const gridEl = document.createElement('div');
        gridEl.className = 'genkouyoushi-grid';

        // 20列の作成
        for (let col = 0; col < 20; col++) {
            const columnEl = document.createElement('div');
            columnEl.className = 'genkouyoushi-column';

            // 各列20行の作成
            for (let row = 0; row < 20; row++) {
                const squareEl = document.createElement('div');
                squareEl.className = 'genkouyoushi-square';

                const charIndex = (col * 20) + row;

                if (charIndex < characters.length && characters[charIndex] !== null) {
                    squareEl.textContent = characters[charIndex];
                }

                columnEl.appendChild(squareEl);
            }
            gridEl.appendChild(columnEl);
        }

        containerEl.appendChild(gridEl);
        pageTemplate.appendChild(containerEl);
        return pageTemplate;
    }

});
