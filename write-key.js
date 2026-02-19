const fs = require('fs');
const path = require('path');

const serviceAccount = {
    "type": "service_account",
    "project_id": "robbit-ramadan-bot",
    "private_key_id": "fe15fa5bc49ff15e4f145028a738b67af539d357",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCyvA5IuZr7mhMY\npXMMScJyWwNSl9c2swQacFehRB2mW5u62p85XVE062S1mPcmI7E59EEZpON/Ittg\nWzcFts7xqrNYZ4ja99rIkAUjO20QSJCJfVXeSKa7htebDXtDpZ8D69Wk08/Pb87/\nGL6ecEb65xeNv0NoCUVU8W0R8g0pLls7uyQWaVr/Fx2yprMjcFcSkOn8ivFXfOnT\notY+eGC/ugX99kUprEyGP0kXUkxMTKXpJoPJP9/AKOsR/UyLi5B0UkIhXXeQ3V2y\nrc9uyEGYvJSMNnPfUiyYWAWrD9HGNBXYdGDDYVeMJLrb92ohpt1wwufAQX1lHzSI\nuM9BwBefAgMBAAECggEAKhx2vRnF8zvE/gyVQ7LpNmpNKRuPYFrjP5tyehODbNuu\noGK8GxbqeC5x5vtoV7sXGZF7+R/JXf4Hc/dpylXdAkF2ygBy1SyKhrCwFTH+K1T9\ngPdf0OSLLCnECMsvXKvcAF+DUbd6AeTU/3OEDe5kOt9RxFro9c0hYbcUPKMsCKR3\nR8TJiXYxkx2ndDz0AkIvBFVeFu/UmC2EoeOKUWDMOBUXtiggZgzHlvAr4i2TFj3H\niMAPUlj63yjTq3TCTWHhAd3V7Lmf2E2zb0t690iXAyP7pSCeGh8EwYBAXF8/HwUV\n1Ll1eJ/nvtwt1Ik7Zn3Z8WR3kNsJ7nZRE14MGyVlSQKBgQDn7dYdBadxPKhfYL7e\nEeDNa2iG/GKY8Xh2nRLm7bQRbOV4CkSxbRMrvhQ3sJkQBTGcAbsgzn+SbdNz2GA9\nBNxYJCtj8r6ENVDhiH+QsSlf2jJhdNHSlSsApSy51L3KqLlyRUFs3BTExi336gqo\nr3/i4Zmg1vxAjcdVUEFafq7wkwKBgQDFSOL3ehLAvMI6Hm/YIdraROtePMGLlBbW\n7jUkvDLIs79R5dYKzk1EdxEKoZKAgR5btrdmuDrzm+rhcYt1Hw+r6GKOfjVuT3hU\nObeAERq9iiqGPAMj6/sfaEjkeM2vJCx0KVo1ihFc3IvMInfBzHSHeovkF/bSRzMB\n5JtXoQnARQKBgQCzfyXD5llV0S06S+TMd6e1M9h9CB3C4rdpjV1Qrk07Yz0hL0lE\ny/cXVo/NHfcIKAziAZDy7f5btHX/ZUnuT7G84ZlXTEpYhe7n7b1UnVg5H+T3+fJd\n+SaD5FH+LIEKtJR5tNHSz22fcQWoplDDhrgCPrmoelpWF6RbCbbas8ru0wKBgHeC\n2OOcUsHpVyvIBm8Cy0ZQW9kBqym380IOmakATS9iHDMrrUdshEhGbM9o44vvLAnZ\nHS8fya6LtHUPyLCRuXelVhcGA64ofDdho3T0Z6OMkIgy0KAxMzZqgUXOnKNNoZRY\n/KnUUwJTJGjsNGn1Rl5P8XCix8XIlfC+oRAroPGVAoGBAJdYJ5U5zw+oHtVLfVK+\nxXQMbppQtyqawWlu6U8wx8iy1wk7ZgLD2/aHsulQDwyk7rCQb1GrG9lx4FDuINAr\n4S1XbL7Z2bU9PbjkVBXXQ9FTAFit/q9uEYnZf4oe9QN3bx27BA7YnUrVmkB2SakM\nIBmpcvgXbmN96zarVz+jCmRY\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-fbsvc@robbit-ramadan-bot.iam.gserviceaccount.com",
    "client_id": "101140231303798460724",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40robbit-ramadan-bot.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
};

// Write both files
const json = JSON.stringify(serviceAccount, null, 2);
fs.writeFileSync(path.join(__dirname, 'firebasekeys.json'), json);
fs.writeFileSync(path.join(__dirname, 'serviceAccountKey.json'), json);
console.log('Both key files written successfully!');
console.log('Project ID:', serviceAccount.project_id);
console.log('Client Email:', serviceAccount.client_email);
