const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const usuariosPath = path.join(__dirname, 'usuarios.json');

function leerUsuarios() {
    if (!fs.existsSync(usuariosPath)) return {};
    return JSON.parse(fs.readFileSync(usuariosPath));
}

function guardarUsuarios(data) {
    fs.writeFileSync(usuariosPath, JSON.stringify(data, null, 2));
}

function generarCodigo() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/enviar-codigo', async (req, res) => {
    const { email } = req.body;
    const codigo = generarCodigo();
    const usuarios = leerUsuarios();
    usuarios[email] = { codigo, verificado: false, cuponUsado: false, fecha: null };
    guardarUsuarios(usuarios);

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    await transporter.sendMail({
        from: `"ESSENCE" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Código de verificación ESSENCE',
        text: `Tu código es: ${codigo}`,
    });

    res.json({ mensaje: 'Código enviado' });
});

app.post('/validar-codigo', (req, res) => {
    const { email, codigoIngresado } = req.body;
    const usuarios = leerUsuarios();
    if (usuarios[email] && usuarios[email].codigo === codigoIngresado) {
        usuarios[email].verificado = true;
        usuarios[email].fecha = new Date().toISOString();
        guardarUsuarios(usuarios);
        return res.json({ validado: true, cupon: 'ESSENCE500' });
    }
    res.json({ validado: false });
});

app.post('/usar-cupon', (req, res) => {
    const { email } = req.body;
    const usuarios = leerUsuarios();
    if (usuarios[email] && usuarios[email].verificado && !usuarios[email].cuponUsado) {
        usuarios[email].cuponUsado = true;
        guardarUsuarios(usuarios);
        return res.json({ usado: true });
    }
    res.json({ usado: false });
});

const adminPassword = 'essenceadmin';
app.get('/admin', (req, res) => {
    const clave = req.query.clave;
    if (clave !== adminPassword) {
        return res.send('<h2>Acceso denegado. Usá ?clave=essenceadmin en la URL</h2>');
    }
    const usuarios = leerUsuarios();
    let html = `<html><head><title>Panel ESSENCE</title></head>
    <body style="background:#111;color:white;font-family:sans-serif;padding:20px">
    <h1>Panel de Administración - Suscriptores</h1>
    <table border="1" cellpadding="8" style="background:#fff; color:#000; border-collapse: collapse;">
    <tr><th>Email</th><th>Verificado</th><th>Cupón Usado</th><th>Fecha</th></tr>`;
    for (const [email, datos] of Object.entries(usuarios)) {
        html += `<tr><td>${email}</td><td>${datos.verificado ? '✔️' : '❌'}</td><td>${datos.cuponUsado ? '✔️' : '❌'}</td><td>${datos.fecha || '-'}</td></tr>`;
    }
    html += '</table></body></html>';
    res.send(html);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
