import { env } from "./env.js";
import { createApp } from "./app.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API Coração Gaúcho ouvindo em http://localhost:${env.PORT}`);
  console.log(`Swagger em http://localhost:${env.PORT}/docs`);
});
