import { app } from './app.js';
import env from './config/env.js';

app.listen(env.port, () => {
  console.log(`Motoworks berjalan di http://localhost:${env.port}`);
});
