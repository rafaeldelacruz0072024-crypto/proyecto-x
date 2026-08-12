const fs = require('fs');
let html = fs.readFileSync('landing.html', 'utf8');

const styleInject = `
        /* LANGUAGE SELECTOR */
        .lang-wrapper {
            position: relative;
            display: inline-block;
        }
        .lang-selector {
            background: rgba(0, 243, 255, 0.05);
            border: 1px solid rgba(0, 243, 255, 0.2);
            color: #00f3ff;
            font-family: 'Chakra Petch';
            font-size: 0.75rem;
            padding: 0.4rem 1rem;
            outline: none;
            cursor: pointer;
            text-transform: uppercase;
            border-radius: 4px;
            letter-spacing: 0.1em;
        }
        .lang-selector option {
            background: #030712;
            color: #fff;
        }
        .VIpgJd-ZVi9od-ORHb-OEVmcd { display: none !important; }
        .goog-te-banner-frame { display: none !important; }
        body { top: 0 !important; }
`;
if (!html.includes('LANGUAGE SELECTOR')) {
    html = html.replace('</style>', styleInject + '</style>');
}

const htmlInject = `<div class="lang-wrapper">
                <select class="lang-selector" onchange="doGTranslate(this.value)">
                    <option value="es">ESP</option>
                    <option value="en">ENG</option>
                    <option value="pt">POR</option>
                    <option value="fr">FRA</option>
                    <option value="de">DEU</option>
                    <option value="it">ITA</option>
                    <option value="ru">RUS</option>
                    <option value="zh-CN">CHN</option>
                    <option value="ja">JPN</option>
                    <option value="ar">ARA</option>
                </select>
                <div id="google_translate_element" style="display:none;"></div>
            </div>`;
if (!html.includes('lang-selector')) {
    html = html.replace('href="#network">Red Global</a>', 'href="#network">Red Global</a>\n            ' + htmlInject);
}

const scriptInject = `<script>
        function googleTranslateElementInit() {
          new google.translate.TranslateElement({pageLanguage: 'es', autoDisplay: false}, 'google_translate_element');
        }
        function doGTranslate(lang) {
            const teCombo = document.querySelector('.goog-te-combo');
            if (!teCombo) {
                setTimeout(() => doGTranslate(lang), 500);
                return;
            }
            teCombo.value = lang;
            if (document.createEvent) {
                const event = document.createEvent('HTMLEvents');
                event.initEvent('change', true, true);
                teCombo.dispatchEvent(event);
            } else {
                teCombo.fireEvent('onchange');
            }
            localStorage.setItem('i18nextLng', lang);
        }
        window.addEventListener('load', () => {
           const savedLang = localStorage.getItem('i18nextLng');
           if (savedLang && savedLang.substring(0,2) !== 'es') {
               const select = document.querySelector('.lang-selector');
               if (select) {
                   const shortLang = savedLang.substring(0,2);
                   // Support zh-CN translation mapping
                   select.value = savedLang.includes('zh') ? 'zh-CN' : shortLang;
                   doGTranslate(select.value);
               }
           }
        });
    </script>
    <script type="text/javascript" src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>`;

if (!html.includes('googleTranslateElementInit')) {
    html = html.replace('</body>', scriptInject + '\n</body>');
}

fs.writeFileSync('landing.html', html);
console.log('Successfully injected language switcher!');
