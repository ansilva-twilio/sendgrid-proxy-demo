## BCP SendGrid Proxy Demo

![Version](https://img.shields.io/badge/Version-0.0.1-blue)

Por André Silva -
Solutions Architect at Twilio Solutions Engineering LATAM

### 📝 Descripción del Problema

El cliente utiliza actualmente el plan SendGrid Premier 50M, pero envía cerca de 300 millones de correos al mes, pagando cargos adicionales por excedente.
Al migrar al plan Premier 300M, podría reducir significativamente su costo por correo, pero este plan no incluye la funcionalidad de Email Activity.

El inconveniente es que el cliente depende de Email Activity para obtener el asunto (Subject) de cada correo, dato que utiliza para su sistema interno de clasificación y asignación de costos.
Sin embargo, el Event Webhook de SendGrid no expone el campo Subject, por lo que no existe una forma directa de reemplazar esa información.

Además, por restricciones internas de seguridad y TI, el cliente no puede modificar sus aplicaciones emisoras ni separar el tráfico por subcuentas, categorías o API keys.
Esto impide incorporar el asunto del correo como metadato en el origen.

⸻

### 🎯 Solución Recomendada - Email Logs

Twilio ha incorporado recientemente una nueva funcionalidad llamada Email Logs, que reemplaza y amplía las capacidades de Email Activity.
Con Email Logs, ahora es posible consultar, filtrar y exportar eventos de envío directamente desde la interfaz (UI), incluyendo búsquedas por Subject, sin necesidad de depender del Email Activity tradicional.

Esta funcionalidad está disponible para todos los planes, incluyendo los superiores a 50M, lo que elimina la limitación anterior y permite mantener la trazabilidad completa de los mensajes sin costo adicional.

Más información:
- https://www.twilio.com/docs/sendgrid/ui/analytics-and-reporting/email-logs 
- https://www.twilio.com/docs/sendgrid/api-reference/email-logs

### 💼 Objetivo del Repositorio como Solución Alternativa (sin utilizar Email Logs)

Permitir al cliente migrar al plan Premier 300M y mantener la visibilidad del Subject de cada envío sin depender de Email Activity, mediante una capa de proxy intermedia que:

- Captura el asunto de cada mensaje antes de enviarlo a SendGrid.
- Inyecta el valor del Subject como metadato (custom_args o unique_args).
- Reenvía el mensaje a SendGrid sin alterar su contenido ni los flujos existentes.
- Hace visible el Subject en el Event Webhook, permitiendo el mismo nivel de trazabilidad y reporte.

---

Este repositorio muestra dos estrategias de continuidad operativa para envíos de correo con SendGrid:

- Un **proxy HTTP** desplegable en Twilio Serverless que reexpide solicitudes a la API v3 de SendGrid.
- Un **proxy SMTP** basado en [Haraka](https://haraka.github.io/) que agrega metadatos y reenvía mensajes al SMTP de SendGrid.

Incluye además un script (`sendmail.js`) para probar tres escenarios: envío directo a SendGrid, envío pasando por el proxy HTTP y envío pasando por el proxy SMTP.

---

### 👨‍💻 Arquitectura del proyecto

- **`api-proxy/sendmail.protected.js`**: Función para Twilio Serverless. Recibe peticiones entrantes (por ejemplo, desde aplicaciones que no pueden invocar SendGrid directamente), inyecta `custom_args.email_subject` y llama a `https://api.sendgrid.com/v3/mail/send`.
- **`smtp-proxy/`**: Instancia de Haraka preconfigurada:
  - Escucha en `localhost:587` (ver `config/smtp.ini`).
  - Autentica contra usuarios definidos en `config/auth_flat_file.ini`.
  - Reenvía mensajes autenticados al SMTP de SendGrid (`config/smtp_forward.ini`).
  - El plugin personalizado `plugins/sg_subject_unique_args.js` agrega un encabezado `X-SMTPAPI` con `unique_args.email_subject`.
- **`sendmail.js`**: Script Node.js que demuestra cómo enviar un mismo correo usando API directa, SMTP directo, proxy HTTP y proxy SMTP.

---

### ✍️ Requisitos previos

- Node.js 18+ y npm.
- Cuenta de SendGrid con una API Key vigente.
- Cuenta de Twilio con acceso a Twilio Serverless (Functions).
- OpenSSL para generar certificados TLS locales.
- (Para el proxy SMTP) Haraka instalado globalmente (`npm install -g Haraka`).

---

### 🛠️ Configuración

1. **Instalar dependencias del repositorio principal**
   ```bash
   npm install
   ```

2. **Crear el archivo `.env`** en la raíz del proyecto:
   ```bash
   cat > .env <<'EOF'
   SENDGRID_API_KEY=SG.xxxxxxxx
   FROM_EMAIL=remitente@tu-dominio.com
   TO_EMAIL=destinatario@tu-dominio.com    # Solo para pruebas locales
   SENDGRID_PROXY_ADDRESS=https://bcp-sendgrid-api-proxy-xxx.twil.io/sendmail.js
   EOF
   ```
   - `SENDGRID_API_KEY`: clave con permisos de envío (`Mail Send`).
   - `FROM_EMAIL`: remitente verificado en SendGrid.
   - `TO_EMAIL`: destinatario de pruebas al ejecutar `sendmail.js`.
   - `SENDGRID_PROXY_ADDRESS`: URL de la Twilio Function para la API Proxy

3. **Verificar que la clave no quede versionada** (asegúrate de tener `.env` en `.gitignore` si usas control de versiones).

---

### Despliegue del proxy HTTP en Twilio

1. Instala y autentica el [Twilio CLI](https://www.twilio.com/docs/twilio-cli/quickstart):
   ```bash
   npm install -g twilio-cli
   twilio login
   ```

2. Desde la raíz del repositorio, despliega la función:
   ```bash
   twilio serverless:deploy \
     --service-name bcp-sendgrid-api-proxy \
     --functions-folder api-proxy
   ```

3. En la consola de Twilio, configura la variable de entorno `SENDGRID_API_KEY` para el servicio recién desplegado (Settings → Environment Variables).

4. El CLI devolverá una URL similar a `https://bcp-sendgrid-api-proxy-XXXX.twil.io/sendmail`. Usa esa URL para actualizar el .env `SENDGRID_PROXY_ADDRESS`.

> **TIP:** Puedes probar el endpoint con `curl`:
> ```bash
> curl -X POST https://<tu-subdominio>.twil.io/sendmail \
>   -H 'Content-Type: application/json' \
>   -d '{"from":{"email":"remitente@tu-dominio.com"},"personalizations":[{"to":[{"email":"destinatario@dominio.com"}],"subject":"Prueba"}],"content":[{"type":"text/html","value":"<h1>Hola</h1>"}]}'
> ```

---

### Puesta en marcha del proxy SMTP (Haraka)

1. **Instala Haraka** (si aún no lo tienes):
   ```bash
   npm install -g Haraka
   ```

2. **Genera certificados TLS locales** (puedes reutilizar certificados válidos si ya cuentas con ellos):
   ```bash
   openssl req -new -x509 -days 365 -nodes \
     -out smtp-proxy/config/tls_cert.pem \
     -keyout smtp-proxy/config/tls_key.pem
   ```
   Ajusta los campos solicitados; para uso local puedes usar valores ficticios.


3. **Configura el reenvío hacia SendGrid** creando un archivo en `smtp-proxy/config/smtp_forward.ini`:
```ini
enable_outbound=true
host=smtp.sendgrid.net
port=587
enable_tls=true
auth_type=plain
auth_user=apikey
auth_pass=SG.xxxxxxxx              ; Sustituye por tu API Key real
always_retry=true
```
   > **Importante:** La clave incluida en el repositorio es solo de ejemplo. Sustitúyela por una clave propia y mantenla fuera del control de versiones.

4. **Inicia Haraka** desde la raíz del repositorio:
   ```bash
   haraka -c smtp-proxy
   ```
   - Por defecto escuchará en `localhost:587` (configurable en `config/smtp.ini`).
   - El plugin `sg_subject_unique_args` se carga automáticamente desde `config/plugins` y añadirá el `X-SMTPAPI` necesario para SendGrid.

5. **Conéctate al proxy SMTP** desde tus aplicaciones usando las credenciales definidas en `auth_flat_file.ini`, puerto `587`, TLS obligatorio y `rejectUnauthorized: false` si usas certificados autofirmados.

---

### Envíos de prueba con `sendmail.js`

```bash
# Envío directo a SendGrid (API + SMTP desde tu máquina)
node sendmail.js direct

# Envío pasando por los proxies (requiere que Twilio y Haraka estén configurados)
node sendmail.js proxy
```

- El modo `direct` verifica que la API y el SMTP de SendGrid funcionen con tu configuración local.
- El modo `proxy` envía primero por la función de Twilio (`sendEmailViaAPIProxy`) y luego por Haraka (`sendEmailViaSMTPProxy`). Revisa la salida estándar para confirmar cada envío.

---

### Solución de problemas

- **400/401 desde la API de Twilio**: revisa que `SENDGRID_API_KEY` esté configurada en el entorno del servicio Serverless.
- **Errores de TLS en el proxy SMTP**: si usas certificados autofirmados, habilita `tls.rejectUnauthorized = false` en tu cliente (en `sendmail.js` ya está configurado).
- **Autenticación fallida en Haraka**: confirma que el usuario y contraseña existan en `auth_flat_file.ini` y que el archivo esté en el mismo directorio `smtp-proxy/config`.
- **Cabeceras X-SMTPAPI incorrectas**: revisa los logs de Haraka; el plugin escribe mensajes `Injected unique_args...` al agregar el encabezado.

Los registros de Haraka aparecerán en la consola donde ejecutaste `haraka -c smtp-proxy`. Para depuración adicional, puedes habilitar niveles de log en `config/log.ini`.

---

### Buenas prácticas y seguridad

- Nunca comprometas claves reales en el repositorio. Usa `.env`, variables de entorno o servicios de gestión de secretos.
- Rota las claves de SendGrid y Twilio si sospechas exposición.
- Limita el acceso de red al puerto `587` cuando corras Haraka en entornos compartidos.
- En producción, utiliza certificados TLS válidos y aplica controles adicionales de autenticación y auditoría.

---

### 🚀 Recursos adicionales

- [Email Logs UI](https://www.twilio.com/docs/sendgrid/ui/analytics-and-reporting/email-logs) 
- [Email Logs API](https://www.twilio.com/docs/sendgrid/api-reference/email-logs)
- [Documentación de SendGrid Mail Send API](https://docs.sendgrid.com/api-reference/mail-send/mail-send)
- [Guía de Twilio Serverless Functions](https://www.twilio.com/docs/serverless/functions-assets)
- [Haraka Documentation](https://github.com/haraka/Haraka/wiki)

