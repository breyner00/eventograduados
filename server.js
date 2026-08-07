const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de EJS y archivos estáticos
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Configuración de Multer para subir los comprobantes de pago
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb) {
        cb(null, 'comprobante-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Conexión a la base de datos SQLite
const db = new sqlite3.Database('./evento.db', (err) => {
    if (err) console.error(err.message);
    console.log('Conectado a la base de datos SQLite.');
});

// Crear tablas si no existen
db.serialize(() => {
    // Tabla de configuraciones (para la cuenta bancaria, etc.)
    db.run(`CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY,
        cuenta_bancaria TEXT,
        precio TEXT
    )`);

    // Insertar configuración por defecto si está vacía
    db.get("SELECT COUNT(*) AS count FROM config", (err, row) => {
        if (row.count === 0) {
            db.run(`INSERT INTO config (cuenta_bancaria, precio) VALUES ('Banco Pichincha - Cuenta Ahorros 123456789 a nombre de Breyner', '$20.00')`);
        }
    });

    // Tabla de inscripciones
    db.run(`CREATE TABLE IF NOT EXISTS inscripciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        email TEXT,
        telefono TEXT,
        es_graduado BOOLEAN,
        comprobante_url TEXT,
        estado TEXT DEFAULT 'Pendiente'
    )`);
});

// RUTAS PÚBLICAS ----------------------------------------------------

app.get('/', (req, res) => {
    db.get("SELECT * FROM config WHERE id = 1", (err, config) => {
        res.render('index', { config });
    });
});

app.post('/inscribirse', upload.single('comprobante'), (req, res) => {
    const { nombre, email, telefono, es_graduado } = req.body;
    const comprobante_url = req.file ? `/public/uploads/${req.file.filename}` : null;
    const graduado_bool = es_graduado === 'on' ? 1 : 0;

    db.run(`INSERT INTO inscripciones (nombre, email, telefono, es_graduado, comprobante_url) VALUES (?, ?, ?, ?, ?)`, 
        [nombre, email, telefono, graduado_bool, comprobante_url], 
        function(err) {
            if (err) return console.log(err.message);
            res.send("<h2>¡Inscripción recibida con éxito! Revisaremos tu pago y te confirmaremos pronto.</h2><a href='/'>Volver</a>");
        }
    );
});

// RUTAS DE ADMINISTRADOR ---------------------------------------------

app.get('/admin', (req, res) => {
    db.get("SELECT * FROM config WHERE id = 1", (err, config) => {
        db.all("SELECT * FROM inscripciones", (err, inscripciones) => {
            res.render('admin', { config, inscripciones });
        });
    });
});

app.post('/admin/actualizar-config', (req, res) => {
    const { cuenta_bancaria, precio } = req.body;
    db.run(`UPDATE config SET cuenta_bancaria = ?, precio = ? WHERE id = 1`, [cuenta_bancaria, precio], (err) => {
        res.redirect('/admin');
    });
});

app.post('/admin/verificar/:id', (req, res) => {
    const id = req.params.id;
    db.run(`UPDATE inscripciones SET estado = 'Verificado' WHERE id = ?`, [id], (err) => {
        res.redirect('/admin');
    });
});

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});