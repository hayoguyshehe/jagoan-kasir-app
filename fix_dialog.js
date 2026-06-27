const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === '.next' || file === 'dist') continue;
    const fullPath = dir + '/' + file;
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const pattern = /\{\/\*\s*@ts-ignore\s*\*\/\}\s*<DialogTrigger\s+asChild>\s*<Button\s+style=\{\{([\s\S]*?)\}\}>\s*<Plus\s+className=\"([^\"]*)\"\s*\/>\s*(.*?)\s*<\/Button>\s*<\/DialogTrigger>/g;
      
      const newContent = content.replace(pattern, (match, style, iconClass, text) => {
        return '<DialogTrigger \n                render={<Button style={{' + style + '}} />}\n              >\n                <Plus className=\"' + iconClass + '\" /> ' + text + '\n              </DialogTrigger>';
      });

      if (content !== newContent) {
         fs.writeFileSync(fullPath, newContent, 'utf8');
         console.log('Fixed', fullPath);
      }
    }
  }
}

processDir('dashboard/src');
