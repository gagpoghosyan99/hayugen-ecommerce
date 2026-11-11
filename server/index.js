const { createApp } = require("./app");

const PORT = Number(process.env.PORT) || 4174;

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`HAYUGEN Maison on http://127.0.0.1:${PORT}`);
  });
}

module.exports = { createApp };
