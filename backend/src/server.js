require('dotenv').config();
const app = require('./app');
const applySchema = require('./shared/db/applySchema');

const PORT = process.env.PORT || 3000;

applySchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API HIS escuchando en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo aplicar el esquema de la base. El servidor no arranca.');
    console.error(err);
    process.exit(1);
  });
