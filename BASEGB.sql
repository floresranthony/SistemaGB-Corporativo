-- 1. Tabla de Permisos y Roles
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE, 
    nombre VARCHAR(50) NOT NULL,        
    descripcion TEXT
);

-- 2. Tus Empresas (Las que asumen la planilla y contratos)
CREATE TABLE empresas_internas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ruc VARCHAR(11) NOT NULL UNIQUE,
    razon_social VARCHAR(150) NOT NULL, 
    representante_legal VARCHAR(150),       
    direccion_fiscal VARCHAR(255),          
    logo_url TEXT DEFAULT NULL,
    activo BOOLEAN DEFAULT TRUE
);

-- 3. Clientes (Vinculados a la empresa con la que firmaron el servicio)
CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_interna_id INT NOT NULL,     
    ruc VARCHAR(11) NOT NULL UNIQUE,     
    razon_social VARCHAR(150) NOT NULL,  
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_cliente_empresa FOREIGN KEY (empresa_interna_id) REFERENCES empresas_internas(id) ON DELETE RESTRICT
);

-- 4. Sedes Operativas (Vinculadas a un Cliente)
CREATE TABLE sedes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,                 
    nombre VARCHAR(150) NOT NULL,            
    direccion VARCHAR(255),                  
    distrito VARCHAR(100),                   
    contacto_nombre VARCHAR(100),            
    contacto_telefono VARCHAR(20),           
    presupuesto DECIMAL(10, 2) DEFAULT 0.00, 
    activo BOOLEAN DEFAULT TRUE,             
    CONSTRAINT fk_sedes_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT
);

-- 5. Usuarios del Sistema
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, 
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    correo VARCHAR(150) UNIQUE,
    rol_id INT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE RESTRICT
);

-- 6. Matriz de Asignación (Supervisores a Sedes)
CREATE TABLE usuario_sedes (
    usuario_id INT NOT NULL,
    sede_id INT NOT NULL,
    PRIMARY KEY (usuario_id, sede_id),
    CONSTRAINT fk_usu_sede_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_usu_sede_sede FOREIGN KEY (sede_id) REFERENCES sedes(id) ON DELETE CASCADE
);

-- ==========================================
-- 7. DICCIONARIOS DE DATOS (CATÁLOGOS)
-- ==========================================

CREATE TABLE cargos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE tipos_documento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE, 
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE tipos_trabajador (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE 
);

CREATE TABLE bancos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE sistemas_pension (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE, 
    tipo ENUM('ONP', 'AFP') NOT NULL    
);

CREATE TABLE regimenes_laborales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE, 
    dias_vacaciones INT NOT NULL        
);

CREATE TABLE modalidades_contrato (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE 
);

-- Ubigeo en formato plano
CREATE TABLE ubigeo_distritos (
    id CHAR(6) PRIMARY KEY,             
    departamento VARCHAR(50) NOT NULL,  
    provincia VARCHAR(50) NOT NULL,     
    distrito VARCHAR(50) NOT NULL       
);

-- ==========================================
-- 8. GESTIÓN DE PERSONAL (SEPARACIÓN LÓGICA)
-- ==========================================

-- 8.1 Ficha Maestra Única (La Persona)
CREATE TABLE personas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Datos Personales
    tipo_documento_id INT NOT NULL,
    numero_documento VARCHAR(20) NOT NULL UNIQUE, 
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    sexo ENUM('Masculino', 'Femenino') NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    direccion VARCHAR(255),
    ubigeo_id CHAR(6),                     
    telefono VARCHAR(20),
    correo VARCHAR(150),
    
    -- Datos Financieros Generales
    banco_sueldo_id INT,
    cuenta_sueldo VARCHAR(50),
    banco_cts_id INT,
    cuenta_cts VARCHAR(50),
    sistema_pension_id INT NOT NULL,
    codigo_cuss_afp VARCHAR(20),
    
    -- Tallas y Médicos (Únicos por individuo)
    fecha_ultimo_emo DATE,
    talla_polo VARCHAR(10),
    talla_pantalon VARCHAR(10),
    talla_calzado VARCHAR(10),
    
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_persona_tipodoc FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documento(id) ON DELETE RESTRICT,
    CONSTRAINT fk_persona_ubigeo FOREIGN KEY (ubigeo_id) REFERENCES ubigeo_distritos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_persona_pension FOREIGN KEY (sistema_pension_id) REFERENCES sistemas_pension(id) ON DELETE RESTRICT,
    CONSTRAINT fk_persona_banco_s FOREIGN KEY (banco_sueldo_id) REFERENCES bancos(id) ON DELETE SET NULL,
    CONSTRAINT fk_persona_banco_c FOREIGN KEY (banco_cts_id) REFERENCES bancos(id) ON DELETE SET NULL
);

-- 8.2 El Puesto Dinámico (Vínculo Laboral)
CREATE TABLE vinculos_laborales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    persona_id INT NOT NULL,               
    
    -- Estructura del Puesto
    empresa_interna_id INT NOT NULL,       
    sede_id INT NOT NULL,                  
    cargo_id INT NOT NULL,
    tipo_trabajador_id INT NOT NULL,
    lugar_especifico_trabajo VARCHAR(150),
    
    -- Condiciones del Vínculo
    regimen_laboral_id INT NOT NULL,
    asignacion_familiar BOOLEAN DEFAULT FALSE,
    sueldo_basico DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    bono DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    
    -- Control de Estado Independiente
    estado ENUM('Activo', 'Inactivo') DEFAULT 'Activo',
    fecha_cese DATE DEFAULT NULL,
    motivo_cese TEXT DEFAULT NULL,
    
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_vinculo_persona FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
    CONSTRAINT fk_vinculo_emp_int FOREIGN KEY (empresa_interna_id) REFERENCES empresas_internas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_vinculo_sede FOREIGN KEY (sede_id) REFERENCES sedes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_vinculo_cargo FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_vinculo_tipo_trab FOREIGN KEY (tipo_trabajador_id) REFERENCES tipos_trabajador(id) ON DELETE RESTRICT,
    CONSTRAINT fk_vinculo_regimen FOREIGN KEY (regimen_laboral_id) REFERENCES regimenes_laborales(id) ON DELETE RESTRICT
);

-- ==========================================
-- 9. HISTORIALES Y CONTROL LEGAL
-- ==========================================

-- 9.1 Historial de Contratos (Atado al Vínculo, no a la Persona)
CREATE TABLE contratos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vinculo_laboral_id INT NOT NULL,
    modalidad_contrato_id INT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE, 
    estado ENUM('Vigente', 'Vencido', 'Renovado', 'Anulado') DEFAULT 'Vigente',
    archivo_pdf VARCHAR(255), 
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_contrato_vinculo FOREIGN KEY (vinculo_laboral_id) REFERENCES vinculos_laborales(id) ON DELETE CASCADE,
    CONSTRAINT fk_contrato_modalidad FOREIGN KEY (modalidad_contrato_id) REFERENCES modalidades_contrato(id) ON DELETE RESTRICT
);

-- 9.2 Control Histórico de Vacaciones (Kardex de Descansos)
CREATE TABLE vacaciones_historico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vinculo_laboral_id INT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias_calendario INT NOT NULL, 
    notas TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_vacaciones_vinculo FOREIGN KEY (vinculo_laboral_id) REFERENCES vinculos_laborales(id) ON DELETE CASCADE
);

-- ==========================================
-- 10. PIZARRA DIGITAL DE RECLUTAMIENTO
-- ==========================================

CREATE TABLE solicitudes_personal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sede_id INT NOT NULL,
    cargo_id INT NOT NULL,
    turno VARCHAR(50) NOT NULL,
    genero_requerido ENUM('Masculino', 'Femenino', 'Indistinto', 'Mixto') DEFAULT 'Indistinto',
    motivo_vacante TEXT,
    plazas_solicitadas INT NOT NULL DEFAULT 1,
    plazas_cubiertas INT NOT NULL DEFAULT 0,
    estado ENUM('Pendiente', 'Parcial', 'Completado') DEFAULT 'Pendiente',
    fecha_solicitud DATE NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_solicitudes_sede FOREIGN KEY (sede_id) REFERENCES sedes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_solicitudes_cargo FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE RESTRICT
);

-- ==========================================
-- 1. DICCIONARIOS LOGÍSTICOS
-- ==========================================
CREATE TABLE categorias_producto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE, 
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE unidades_medida (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE,  
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE proveedores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ruc VARCHAR(11) NOT NULL UNIQUE,
    razon_social VARCHAR(150) NOT NULL,
    contacto_nombre VARCHAR(100),
    contacto_telefono VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tallas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    valor VARCHAR(10) NOT NULL UNIQUE,   
    activo BOOLEAN DEFAULT TRUE
);

-- ==========================================
-- 2. CATÁLOGO CENTRAL Y VARIANTES
-- ==========================================
CREATE TABLE productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) UNIQUE,                  
    categoria_id INT NOT NULL,
    unidad_medida_id INT NOT NULL,
    proveedor_id INT,                        
    
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio_unitario DECIMAL(10, 2) DEFAULT 0.00,
    
    es_uniforme BOOLEAN DEFAULT FALSE,       
    
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_prod_categoria FOREIGN KEY (categoria_id) REFERENCES categorias_producto(id) ON DELETE RESTRICT,
    CONSTRAINT fk_prod_umedida FOREIGN KEY (unidad_medida_id) REFERENCES unidades_medida(id) ON DELETE RESTRICT,
    CONSTRAINT fk_prod_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL
);

CREATE TABLE producto_tallas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    talla_id INT NOT NULL,                   
    stock_actual INT NOT NULL DEFAULT 0,
    
    CONSTRAINT fk_ptalla_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    CONSTRAINT fk_ptalla_catalogo FOREIGN KEY (talla_id) REFERENCES tallas(id) ON DELETE RESTRICT,
    CONSTRAINT uk_producto_talla UNIQUE (producto_id, talla_id) 
);

-- ==========================================
-- 3. AUDITORÍA DE INVENTARIO
-- ==========================================
CREATE TABLE auditoria_stock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_talla_id INT NOT NULL,
    usuario_id INT NOT NULL,                 
    
    tipo_movimiento ENUM('Ingreso', 'Salida') NOT NULL,
    cantidad INT NOT NULL,                   
    stock_previo INT NOT NULL,               
    stock_nuevo INT NOT NULL,                
    
    motivo VARCHAR(255) NOT NULL,            
    requerimiento_id INT DEFAULT NULL, -- Se actualiza cuando el requerimiento es aprobado
    
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_auditoria_ptalla FOREIGN KEY (producto_talla_id) REFERENCES producto_tallas(id) ON DELETE CASCADE,
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
    -- Nota: No ponemos FK estricta a requerimientos aún para evitar dependencias circulares al crear las tablas, se maneja por lógica de backend.
);
-- ==========================================
-- 4. GESTIÓN DE REQUERIMIENTOS
-- ==========================================
CREATE TABLE requerimientos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,      -- Se usará también para el Vale de Salida PDF
    
    -- Origen y Responsables
    sede_id INT NOT NULL,                    
    usuario_solicitante_id INT NOT NULL,     
    usuario_aprobador_id INT DEFAULT NULL,   -- Se llena cuando Logística o Almacén aprueba
    
    -- Lógica de Flujo
    tipo_solicitud ENUM('Materiales_y_EPP', 'Uniformes_Almacen') NOT NULL,
    afecta_stock BOOLEAN NOT NULL DEFAULT FALSE, 
    
    -- Trazabilidad de Estados
    estado ENUM(
        'Borrador', 
        'Pendiente Aprobacion', 
        'Aprobado', 
        'Enviado', 
        'Entregado', 
        'Entregado Incompleto', 
        'Rechazado'
    ) DEFAULT 'Borrador',
    
    -- Auditoría General
    motivo_rechazo TEXT DEFAULT NULL,
    notas_entrega_incompleta TEXT DEFAULT NULL,
    
    -- Tiempos Exactos (Para KPIs del Dashboard)
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_aprobacion TIMESTAMP NULL DEFAULT NULL,
    fecha_envio TIMESTAMP NULL DEFAULT NULL,
    fecha_entrega TIMESTAMP NULL DEFAULT NULL,
    
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_req_sede FOREIGN KEY (sede_id) REFERENCES sedes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_req_solicitante FOREIGN KEY (usuario_solicitante_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT fk_req_aprobador FOREIGN KEY (usuario_aprobador_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ==========================================
-- 5. DETALLE DEL PEDIDO (LÍNEA POR LÍNEA)
-- ==========================================
CREATE TABLE requerimiento_detalles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requerimiento_id INT NOT NULL,
    
    -- El Ítem
    producto_id INT NOT NULL,
    producto_talla_id INT DEFAULT NULL,      
    
    -- El Destinatario (Kardex)
    vinculo_laboral_id INT DEFAULT NULL,     
    
    -- Control de Cantidades (El ciclo de vida del ítem)
    cantidad_solicitada INT NOT NULL,
    cantidad_aprobada INT DEFAULT 0,
    cantidad_entregada INT DEFAULT 0,        -- Clave para resolver el estado "Entregado Incompleto"
    
    -- Auditoría Específica
    motivo_modificacion VARCHAR(255) DEFAULT NULL,
    
    CONSTRAINT fk_detalle_req FOREIGN KEY (requerimiento_id) REFERENCES requerimientos(id) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_prod FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_detalle_talla FOREIGN KEY (producto_talla_id) REFERENCES producto_tallas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_detalle_vinculo FOREIGN KEY (vinculo_laboral_id) REFERENCES vinculos_laborales(id) ON DELETE RESTRICT
);

ALTER TABLE personas 
ADD COLUMN fecha_ingreso DATE,
ADD COLUMN fecha_primer_contrato DATE;

-- 1. Vincular los colaboradores con su solicitud original de la pizarra
ALTER TABLE vinculos_laborales ADD COLUMN solicitud_id INT DEFAULT NULL;
ALTER TABLE vinculos_laborales ADD CONSTRAINT fk_vinculo_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes_personal(id) ON DELETE SET NULL;
-- 2. Restricción única de un solo vínculo activo por colaborador y empresa
CREATE UNIQUE INDEX unique_active_vinculo_per_empresa 
ON vinculos_laborales (persona_id, empresa_interna_id) 
WHERE (estado = 'Activo');