const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb) {
        cb(null, 'comprobante-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const db = new sqlite3.Database('./evento.db', (err) => {
    if (err) console.error(err.message);
    console.log('Conectado a la base de datos SQLite.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY,
        cuenta_bancaria TEXT
    )`);

    db.get("SELECT COUNT(*) AS count FROM config", (err, row) => {
        if (row.count === 0) {
            db.run(`INSERT INTO config (cuenta_bancaria) VALUES ('Banco Pichincha - Cuenta Ahorros 123456789')`);
        }
    });

    // Agregamos la columna "es_graduado" para uso exclusivo del administrador
    db.run(`CREATE TABLE IF NOT EXISTS inscripciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        email TEXT,
        telefono TEXT,
        sede TEXT,
        comprobante_url TEXT,
        estado TEXT DEFAULT 'Pendiente',
        es_graduado INTEGER DEFAULT 0
    )`);
});

// RUTAS PÚBLICAS
app.get('/', (req, res) => {
    db.get("SELECT * FROM config WHERE id = 1", (err, config) => {
        res.render('index', { config });
    });
});

app.post('/inscribirse', upload.single('comprobante'), (req, res) => {
    const { nombre, email, telefono, sede } = req.body;
    const comprobante_url = req.file ? `/public/uploads/${req.file.filename}` : null;

    db.run(`INSERT INTO inscripciones (nombre, email, telefono, sede, comprobante_url) VALUES (?, ?, ?, ?, ?)`, 
        [nombre, email, telefono, sede, comprobante_url], 
        function(err) {
            if (err) return console.log(err.message);
            res.send("<body style='background:#121212; color:#ff7b00; text-align:center; padding:50px; font-family:sans-serif;'><h2>¡Inscripción recibida con éxito en el sistema!</h2><p style='color:white'>Verificaremos los datos para la gran noche de GENCANA.</p></body>");
        }
    );
});

// RUTAS DE ADMINISTRADOR
app.get('/admin', (req, res) => {
    db.get("SELECT * FROM config WHERE id = 1", (err, config) => {
        db.all("SELECT * FROM inscripciones", (err, inscripciones) => {
            res.render('admin', { config, inscripciones });
        });
    });
});

app.post('/admin/actualizar-config', (req, res) => {
    const { cuenta_bancaria } = req.body;
    db.run(`UPDATE config SET cuenta_bancaria = ? WHERE id = 1`, [cuenta_bancaria], (err) => {
        res.redirect('/admin');
    });
});

app.post('/admin/verificar/:id', (req, res) => {
    const id = req.params.id;
    db.run(`UPDATE inscripciones SET estado = 'Verificado' WHERE id = ?`, [id], (err) => {
        res.redirect('/admin');
    });
});

// NUEVO: Ruta para alternar si es graduado o no
app.post('/admin/graduado/:id', (req, res) => {
    const id = req.params.id;
    db.get(`SELECT es_graduado FROM inscripciones WHERE id = ?`, [id], (err, row) => {
        const nuevoEstado = row.es_graduado === 1 ? 0 : 1;
        db.run(`UPDATE inscripciones SET es_graduado = ? WHERE id = ?`, [nuevoEstado, id], (err) => {
            res.redirect('/admin');
        });
    });
});

// NUEVO: Ruta para eliminar un registro
app.post('/admin/eliminar/:id', (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM inscripciones WHERE id = ?`, [id], (err) => {
        res.redirect('/admin');
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});