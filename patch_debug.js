const fs = require("fs");
const path = "D:\\Code\\art_website\\functions\\api\\admin\\password.js";
let c = fs.readFileSync(path, "utf8");

c = c.replace(
  "    console.error('change password failed:', error);\n    return json({ ok: false, error: 'internal_error', message: '密码修改失败' }, 500);",
  "    console.error('change password failed:', error);\n    return json({ ok: false, error: 'internal_error', message: '密码修改失败：' + (error && error.message ? error.message : String(error)) }, 500);"
);

fs.writeFileSync(path, c, "utf8");
console.log("Patched password.js with detailed error");