CREATE DATABASE IF NOT EXISTS vitrina_emprendedora
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE vitrina_emprendedora;

DROP TABLE IF EXISTS emprendimiento_fotos;
DROP TABLE IF EXISTS emprendimiento_especialidades;
DROP TABLE IF EXISTS emprendimiento_calificaciones;
DROP TABLE IF EXISTS emprendedores;
DROP TABLE IF EXISTS usuarios;

CREATE TABLE usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario VARCHAR(80) NOT NULL UNIQUE,
  password_hash CHAR(64) NOT NULL,
  emprendimiento_id INT UNSIGNED NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE emprendedores (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NULL,
  nombre VARCHAR(160) NOT NULL,
  negocio VARCHAR(180) NOT NULL,
  categoria VARCHAR(80) NOT NULL,
  descripcion TEXT,
  detalle TEXT,
  calificacion DECIMAL(2,1) DEFAULT 0,
  total_resenas INT UNSIGNED DEFAULT 0,
  telefono VARCHAR(80),
  email VARCHAR(180),
  ubicacion VARCHAR(180),
  imagen TEXT,
  horarios VARCHAR(180),
  instagram VARCHAR(180),
  facebook VARCHAR(180),
  registro_datos LONGTEXT,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE emprendimiento_especialidades (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  emprendimiento_id INT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  orden INT UNSIGNED DEFAULT 0,
  FOREIGN KEY (emprendimiento_id) REFERENCES emprendedores(id) ON DELETE CASCADE
);

CREATE TABLE emprendimiento_fotos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  emprendimiento_id INT UNSIGNED NOT NULL,
  url LONGTEXT NOT NULL,
  orden INT UNSIGNED DEFAULT 0,
  FOREIGN KEY (emprendimiento_id) REFERENCES emprendedores(id) ON DELETE CASCADE
);

CREATE TABLE emprendimiento_calificaciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  emprendimiento_id INT UNSIGNED NOT NULL,
  votante_hash CHAR(64) NOT NULL,
  calificacion TINYINT UNSIGNED NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_voto_emprendimiento (emprendimiento_id, votante_hash),
  FOREIGN KEY (emprendimiento_id) REFERENCES emprendedores(id) ON DELETE CASCADE
);

-- La base arranca sin emprendimientos de ejemplo.
-- Los registros nuevos se cargan desde registro.html mediante api/register.php.
