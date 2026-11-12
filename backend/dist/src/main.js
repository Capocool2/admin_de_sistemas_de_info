"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const logger = new common_1.Logger('SAME_Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger.log(`=============================================================`);
    logger.log(`🚀 Sistema SAME Backend iniciado exitosamente en puerto: ${port}`);
    logger.log(`🌐 Servidor HTTP API: http://localhost:${port}`);
    logger.log(`🛰️ Servidor WebSocket (Socket.io): ws://localhost:${port}`);
    logger.log(`📍 Contexto Operativo: Gran Malecón del Río (Barranquilla)`);
    logger.log(`=============================================================`);
}
bootstrap();
//# sourceMappingURL=main.js.map