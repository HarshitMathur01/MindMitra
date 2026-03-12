const fs = require('fs');
const file = '/Users/harshitmathur/Desktop/MindMitra/src/pages/PublicLanding.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/<ScrollToTop \/>\n        <\/div>\n    \);\n};\n\nexport default PublicLanding;/g, "<ScrollToTop />\n            </div>\n        </div>\n    );\n};\n\nexport default PublicLanding;");
fs.writeFileSync(file, content);
