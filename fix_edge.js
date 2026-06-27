const fs = require('fs');
const path = require('path');
const dirs = ['manage-business-cycle','manage-users','process-transaction','stock-opname','void-transaction'];
for (const d of dirs) {
  const p = path.join('supabase', 'functions', d, 'index.ts');
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/import \{ createAdminClient \} from \"npm:@supabase\/sdk\";/g, 'import { createClient } from \"npm:@supabase/supabase-js@2\";');
    content = content.replace(/createAdminClient\(\{[\s\S]*?baseUrl:\s*(.*?),[\s\S]*?apiKey:\s*(.*?)[\s\S]*?\}\)/g, 'createClient($1, $2)');
    fs.writeFileSync(p, content, 'utf8');
    console.log('Fixed ' + p);
  }
}
