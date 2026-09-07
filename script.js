// Datos genericos de emprendedores. Luego se pueden reemplazar por datos de una base local.
const emprendedores = []

const API_BASE = "api"
let emprendedoresDesdeDb = null

function getEmprendedores() {
  return emprendedoresDesdeDb || emprendedores
}

function getEmprendimientoById(id) {
  return getEmprendedores().find((item) => item.id === id) || getEmprendedores()[0]
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}/${path}`, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  })

  const raw = await response.text()
  let data = {}

  try {
    data = raw ? JSON.parse(raw) : {}
  } catch (error) {
    throw new Error("La API no devolvio una respuesta valida. Revisa la conexion con MySQL en api/config.php.")
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "No se pudo completar la operacion")
  }
  return data
}

async function rootRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "No se pudo completar la operacion")
  }
  return data
}

async function cargarEmprendedoresDesdeDb() {
  try {
    const data = await apiRequest("emprendedores.php")
    emprendedoresDesdeDb = data.emprendedores
    cargarEmprendedores()
    cargarDetalleEmprendimiento()
  } catch (error) {
    console.warn("No se pudo conectar con la base local. Se muestran datos de ejemplo.", error)
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function uploadImageFiles(files, uploadPath = "api/upload-image.php") {
  const imageFiles = Array.from(files || [])
  if (!imageFiles.length) return []

  const formData = new FormData()
  imageFiles.forEach((file) => formData.append("imagenes[]", file))

  const response = await fetch(uploadPath, {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "No se pudieron subir las imagenes")
  }

  return Array.isArray(data.urls) ? data.urls : []
}

function getCheckedValues(form, name) {
  return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value)
}

function formatRatingValue(value) {
  const rating = Number(value) || 0
  return rating > 0 ? rating.toFixed(1) : "Sin calificar"
}

function renderRatingSummary(emp) {
  return `
    <div class="rating">
        <div class="stars">
            ${generarEstrellas(emp.calificacion)}
        </div>
        <span class="rating-text">${formatRatingValue(emp.calificacion)}</span>
    </div>
  `
}

function renderAnonymousRating(emp) {
  const voted = Boolean(emp.calificadoPorEsteVisitante)
  return `
    <div class="anonymous-rating" data-rating-widget="${emp.id}">
        <div class="rating-stars-control" aria-label="Calificar ${emp.negocio}">
            ${[1, 2, 3, 4, 5]
              .map(
                (value) => `
                  <button class="rating-star-button" type="button" data-rating-value="${value}" ${voted ? "disabled" : ""} aria-label="${value} estrellas">
                      ${generarEstrella(value <= Math.round(Number(emp.calificacion) || 0))}
                  </button>
                `,
              )
              .join("")}
        </div>
        <span class="rating-status">${voted ? "Ya calificaste" : "Calificar"}</span>
    </div>
  `
}

function updateEmprendimiento(updated) {
  emprendedoresDesdeDb = getEmprendedores().map((emp) => (emp.id === updated.id ? updated : emp))
}
function cargarEmprendedores(categoria = "todas") {
  const grid = document.getElementById("emprendedoresGrid")
  if (!grid) return

  const listaEmprendedores = getEmprendedores()
  const emprendedoresFiltrados =
    categoria === "todas" ? listaEmprendedores : listaEmprendedores.filter((e) => e.categoria === categoria)

  if (!emprendedoresFiltrados.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No hay emprendimientos cargados</h3>
        <p>Cuando alguien complete el registro, su emprendimiento aparecera en esta seccion.</p>
        <a class="btn btn-primary" href="registro.html">Registrar emprendimiento</a>
      </div>
    `
    return
  }

  grid.innerHTML = emprendedoresFiltrados
    .map(
      (emp) => {
        const imagenPrincipal = emp.imagen || emp.fotos?.[0] || "logo.jpeg"
        return `
        <div class="emprendedor-card">
            <div class="emprendedor-image">
                <img src="${imagenPrincipal}" alt="${emp.nombre}">
                <div class="emprendedor-badge">${getCategoriaLabel(emp.categoria)}</div>
            </div>
            <div class="emprendedor-content">
                <div class="emprendedor-header">
                    <h3 class="emprendedor-title">${emp.negocio}</h3>
                    <p class="emprendedor-subtitle">${emp.nombre}</p>
                </div>
                ${renderRatingSummary(emp)}
                ${renderAnonymousRating(emp)}
                <p class="emprendedor-description">${emp.descripcion}</p>
                <div class="especialidades">
                    ${emp.especialidades.map((esp) => `<span class="especialidad-badge">${esp}</span>`).join("")}
                </div>
                <div class="contact-info">
                    <div class="contact-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        <span>${emp.telefono}</span>
                    </div>
                    <div class="contact-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        <span>${emp.email}</span>
                    </div>
                    <div class="contact-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <span>${emp.ubicacion}</span>
                    </div>
                </div>
                <div class="emprendedor-actions">
                    <button class="btn btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        Contactar
                    </button>
                    <a class="btn btn-outline" href="emprendimiento-detalle.html?id=${emp.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        Ver mas
                    </a>
                </div>
            </div>
        </div>
    `
      },
    )
    .join("")

  initRatingWidgets(grid)
}

function generarEstrella(filled) {
  return `<svg class="star ${filled ? "filled" : "empty"}" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>`
}

function generarEstrellas(calificacion) {
  let html = ""
  for (let i = 1; i <= 5; i++) {
    html += generarEstrella(i <= Math.round(Number(calificacion) || 0))
  }
  return html
}

function initRatingWidgets(scope = document) {
  scope.querySelectorAll("[data-rating-widget]").forEach((widget) => {
    const emprendimientoId = Number(widget.getAttribute("data-rating-widget"))
    const status = widget.querySelector(".rating-status")

    widget.querySelectorAll("[data-rating-value]").forEach((button) => {
      button.addEventListener("click", async () => {
        const calificacion = Number(button.getAttribute("data-rating-value"))
        widget.querySelectorAll("button").forEach((item) => {
          item.disabled = true
        })
        if (status) status.textContent = "Guardando..."

        try {
          const data = await apiRequest(`emprendedores.php?action=calificar&id=${emprendimientoId}`, {
            method: "POST",
            body: JSON.stringify({
              calificacion,
            }),
          })
          updateEmprendimiento(data.emprendimiento)
          cargarEmprendedores()
          cargarDetalleEmprendimiento()
        } catch (error) {
          if (status) status.textContent = error.message
          widget.querySelectorAll("button").forEach((item) => {
            item.disabled = false
          })
        }
      })
    })
  })
}

function getCategoriaLabel(categoria) {
  const labels = {
    gastronomia: "Gastronomia",
    artesanias: "Artesanias",
    belleza: "Belleza y Cuidado",
    indumentaria: "Indumentaria y Moda",
    tecnologia: "Tecnologia",
    alimentacion: "Alimentacion",
    servicios: "Servicios Profesionales",
    educacion: "Educacion",
    salud: "Salud y Bienestar",
    decoracion: "Decoracion y Hogar",
    arte: "Arte y Cultura",
    otros: "Otros",
  }
  return labels[categoria] || categoria
}

function cargarDetalleEmprendimiento() {
  const detail = document.getElementById("emprendimientoDetalle")
  if (!detail) return

  const params = new URLSearchParams(window.location.search)
  const id = Number(params.get("id")) || getEmprendedores()[0]?.id || 0
  const emp = getEmprendimientoById(id)
  if (!emp) {
    detail.innerHTML = `
      <section class="empty-state">
        <h3>Emprendimiento no disponible</h3>
        <p>Este emprendimiento no existe o todavia no fue cargado desde el registro.</p>
        <a class="btn btn-primary" href="emprendedores.html">Volver a emprendedores</a>
      </section>
    `
    return
  }
  const fotos = emp.fotos && emp.fotos.length ? emp.fotos : [emp.imagen || "logo.jpeg"]

  document.title = `${emp.negocio} - Vitrina Emprendedora`

  detail.innerHTML = `
    <section class="emprendimiento-detail-hero">
        <div class="emprendimiento-carousel" data-carousel>
            <div class="emprendimiento-carousel-track">
                ${fotos
                  .map(
                    (foto, index) => `
                        <img class="emprendimiento-carousel-image ${index === 0 ? "active" : ""}" src="${foto}" alt="${emp.negocio} foto ${index + 1}">
                    `,
                  )
                  .join("")}
            </div>
            <div class="emprendedor-badge">${getCategoriaLabel(emp.categoria)}</div>
            <button class="carousel-control carousel-prev" type="button" data-carousel-prev aria-label="Foto anterior">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 18l-6-6 6-6"/>
                </svg>
            </button>
            <button class="carousel-control carousel-next" type="button" data-carousel-next aria-label="Foto siguiente">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6"/>
                </svg>
            </button>
            <div class="carousel-dots">
                ${fotos
                  .map(
                    (_, index) => `
                        <button class="carousel-dot ${index === 0 ? "active" : ""}" type="button" data-carousel-dot="${index}" aria-label="Ver foto ${index + 1}"></button>
                    `,
                  )
                  .join("")}
            </div>
        </div>
        <div class="emprendimiento-detail-content">
            <p class="emprendedor-subtitle">${emp.nombre}</p>
            <h1 class="page-title">${emp.negocio}</h1>
            ${renderRatingSummary(emp)}
            ${renderAnonymousRating(emp)}
            <p class="emprendimiento-detail-description">${emp.detalle || emp.descripcion}</p>
            <div class="especialidades">
                ${emp.especialidades.map((esp) => `<span class="especialidad-badge">${esp}</span>`).join("")}
            </div>
            <div class="emprendimiento-detail-actions">
                <a class="btn btn-outline" href="emprendedores.html">Volver</a>
            </div>
        </div>
    </section>

    <section class="emprendimiento-detail-info">
        <div>
            <h2>Datos de contacto</h2>
            <p><strong>Telefono:</strong> ${emp.telefono}</p>
            <p><strong>Email:</strong> ${emp.email}</p>
            <p><strong>Ubicacion:</strong> ${emp.ubicacion}</p>
            <p><strong>Instagram:</strong> ${emp.redesSociales?.instagram || "Instagram del emprendimiento"}</p>
            <p><strong>Facebook:</strong> ${emp.redesSociales?.facebook || "Facebook del emprendimiento"}</p>
        </div>
        <div>
            <h2>Informacion adicional</h2>
            <p><strong>Horarios:</strong> ${emp.horarios}</p>
            <p><strong>Categoria:</strong> ${getCategoriaLabel(emp.categoria)}</p>
        </div>
    </section>
  `

  iniciarCarruselEmprendimiento(detail)
  initRatingWidgets(detail)
}

function iniciarCarruselEmprendimiento(detail) {
  const carousel = detail.querySelector("[data-carousel]")
  if (!carousel) return

  const images = Array.from(carousel.querySelectorAll(".emprendimiento-carousel-image"))
  const dots = Array.from(carousel.querySelectorAll("[data-carousel-dot]"))
  const prev = carousel.querySelector("[data-carousel-prev]")
  const next = carousel.querySelector("[data-carousel-next]")
  let activeIndex = 0

  function showImage(index) {
    activeIndex = (index + images.length) % images.length
    images.forEach((image, imageIndex) => image.classList.toggle("active", imageIndex === activeIndex))
    dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === activeIndex))
  }

  prev?.addEventListener("click", () => showImage(activeIndex - 1))
  next?.addEventListener("click", () => showImage(activeIndex + 1))
  dots.forEach((dot) => {
    dot.addEventListener("click", () => showImage(Number(dot.getAttribute("data-carousel-dot"))))
  })
}

function initLogin() {
  const loginForm = document.getElementById("loginForm")
  if (!loginForm) return

  const message = document.getElementById("loginMessage")
  const googleHelp = document.getElementById("googleLoginHelp")
  const googleArea = document.getElementById("googleLoginArea")
  const googleDivider = document.getElementById("googleLoginDivider")
  const googleFallbackButton = document.getElementById("googleFallbackButton")

  function setLoginMessage(text, isError = false) {
    if (!message) return
    message.textContent = text
    message.classList.toggle("error", isError)
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    const usuario = document.getElementById("loginUsuario").value.trim()
    const password = document.getElementById("loginPassword").value.trim()

    try {
      const eventLogin = await fetch("api/events.php?action=login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password }),
      })
      if (eventLogin.ok && (await eventLogin.json()).ok) {
        window.location.replace("gestion-eventos.html")
        return
      }
    } catch (_error) {
      // Si MongoDB aún no está configurado, se intenta el acceso normal.
    }

    try {
      setLoginMessage("Ingresando...")

      await apiRequest("login.php", {
        method: "POST",
        body: JSON.stringify({ usuario, password }),
      })
      window.location.replace("editprofile.html?v=6")
    } catch (error) {
      setLoginMessage(error.message, true)
    }
  })

  async function handleGoogleCredential(response) {
    try {
      setLoginMessage("Validando cuenta de Google...")
      await apiRequest("google-login.php", {
        method: "POST",
        body: JSON.stringify({ credential: response.credential }),
      })
      window.location.replace("editprofile.html?v=6")
    } catch (error) {
      setLoginMessage(error.message, true)
    }
  }

  async function initGoogleLogin() {
    const googleButton = document.getElementById("googleSignInButton")
    if (!googleButton) return
    if (googleArea) googleArea.hidden = false
    if (googleDivider) googleDivider.hidden = false

    function showGoogleSetupMessage(text) {
      googleButton.hidden = true
      if (googleFallbackButton) googleFallbackButton.hidden = false
      if (googleHelp) googleHelp.textContent = text
    }

    googleFallbackButton?.addEventListener("click", () => {
      setLoginMessage("Para usar Google falta pegar un OAuth Client ID valido en api/config.php.", true)
    })

    try {
      const config = await apiRequest("google-config.php")
      if (!config.configured || !config.clientId) {
        showGoogleSetupMessage("Falta pegar tu OAuth Client ID de Google en api/config.php.")
        return
      }

      if (googleFallbackButton) googleFallbackButton.hidden = true
      googleButton.hidden = false

      let googleLoaded = false
      const waitForGoogle = setInterval(() => {
        if (!window.google?.accounts?.id) return

        googleLoaded = true
        clearInterval(waitForGoogle)
        window.google.accounts.id.initialize({
          client_id: config.clientId,
          callback: handleGoogleCredential,
        })
        window.google.accounts.id.renderButton(googleButton, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          width: 320,
        })
      }, 100)

      setTimeout(() => {
        clearInterval(waitForGoogle)
        if (!googleLoaded) {
          showGoogleSetupMessage("No se pudo cargar Google. Revisa la conexion a internet y abre el sitio desde localhost.")
        }
      }, 5000)
    } catch (error) {
      showGoogleSetupMessage("Para usar Google abrí el sitio desde http://localhost/Municipalidad/login.html.")
    }
  }

  initGoogleLogin()

  apiRequest("session.php")
    .then((session) => {
      if (session.authenticated) {
        window.location.replace("editprofile.html?v=6")
      }
    })
    .catch(() => {})
}

async function initAuthNav() {
  const loginLink = document.querySelector(".nav-login")
  if (!loginLink) return

  try {
    const session = await apiRequest("session.php")
    if (session.authenticated && loginLink) {
      loginLink.textContent = "Panel emprendedor"
      loginLink.href = "editprofile.html"
    }
  } catch (error) {
    console.warn("No se pudo verificar la sesion.", error)
  }
}

async function initEditProfile() {
  const form = document.getElementById("editProfileForm")
  if (!form) return
  form.hidden = true

  let session
  try {
    session = await apiRequest("session.php")
  } catch (error) {
    window.location.href = "login.html"
    return
  }

  if (!session.authenticated) {
    window.location.href = "login.html"
    return
  }

  const message = document.getElementById("editProfileMessage")
  const description = document.getElementById("editProfileDescription")
  const emprendimientosPanel = document.getElementById("profileEmprendimientos")
  const especialidadesEditor = document.getElementById("especialidadesEditor")
  const fotosEditor = document.getElementById("fotosEditor")
  let accountEmprendimientos = Array.isArray(session.emprendimientos) ? session.emprendimientos : []
  let profile

  function setValue(id, value) {
    const input = document.getElementById(id)
    if (input) input.value = value == null ? "" : String(value)
  }

  function getValue(id) {
    return document.getElementById(id)?.value.trim() || ""
  }

  function renderEspecialidades() {
    especialidadesEditor.innerHTML = profile.especialidades
      .map(
        (item, index) => `
          <span class="editable-chip">
              ${item}
              <button type="button" data-remove-specialty="${index}" aria-label="Eliminar ${item}">x</button>
          </span>
        `,
      )
      .join("")

    especialidadesEditor.querySelectorAll("[data-remove-specialty]").forEach((button) => {
      button.addEventListener("click", () => {
        profile.especialidades.splice(Number(button.getAttribute("data-remove-specialty")), 1)
        renderEspecialidades()
      })
    })
  }

  function renderFotos() {
    fotosEditor.innerHTML = profile.fotos
      .map(
        (foto, index) => `
          <div class="editable-photo">
              <img src="${foto}" alt="Foto ${index + 1} del emprendimiento">
              <button type="button" data-remove-photo="${index}">Eliminar</button>
          </div>
        `,
      )
      .join("")

    fotosEditor.querySelectorAll("[data-remove-photo]").forEach((button) => {
      button.addEventListener("click", () => {
        profile.fotos.splice(Number(button.getAttribute("data-remove-photo")), 1)
        renderFotos()
      })
    })
  }

  function populateForm() {
    if (!profile) return
    form.hidden = false
    setValue("profileNegocio", profile.negocio)
    setValue("profileNombre", profile.nombre)
    setValue("profileCategoria", profile.categoria)
    setValue("profileTelefono", profile.telefono)
    setValue("profileEmail", profile.email)
    setValue("profileUbicacion", profile.ubicacion)
    setValue("profileInstagram", profile.redesSociales?.instagram)
    setValue("profileFacebook", profile.redesSociales?.facebook)
    setValue("profileHorarios", profile.horarios)
    setValue("profileDescripcion", profile.descripcion)
    setValue("profileDetalle", profile.detalle)
    renderEspecialidades()
    renderFotos()

    if (description) {
      description.textContent = `Modifica los datos de ${profile.negocio || "este emprendimiento"}.`
    }
  }

  function renderEmprendimientosPanel() {
    if (!emprendimientosPanel) return

    if (!accountEmprendimientos.length) {
      form.hidden = true
      emprendimientosPanel.innerHTML = `
        <section class="login-emprendimientos-panel">
          <div class="login-emprendimientos-header">
            <div>
              <span class="login-kicker">Panel emprendedor</span>
              <h2>No hay emprendimientos cargados</h2>
              <p>Registra tu primer emprendimiento para empezar a editar su perfil.</p>
            </div>
            <a class="btn btn-primary" href="registro.html">Registrar emprendimiento</a>
          </div>
        </section>
      `
      return
    }

    emprendimientosPanel.innerHTML = `
      <section class="login-emprendimientos-panel">
        <div class="login-emprendimientos-header">
          <div>
            <span class="login-kicker">Panel emprendedor</span>
            <h2>Elige que emprendimiento quieres editar</h2>
            <p>Selecciona una tarjeta para abrir sus datos o registra otro emprendimiento con esta cuenta.</p>
          </div>
          <a class="btn btn-outline" href="registro.html">Registrar otro</a>
        </div>
        <div class="login-emprendimientos-grid">
          ${accountEmprendimientos
            .map((item) => {
              const image = item.imagen || "logo.jpeg"
              const categoria = getCategoriaLabel(item.categoria || "Emprendimiento")
              const descripcion = item.descripcion || "Editar datos del emprendimiento"
              const activeClass = profile && Number(item.id) === Number(profile.id) ? " active" : ""
              return `
                <button class="login-emprendimiento-card${activeClass}" type="button" data-profile-emprendimiento-id="${item.id}">
                  <span class="login-card-image">
                    <img src="${image}" alt="${item.negocio}">
                    <span class="emprendedor-badge">${categoria}</span>
                  </span>
                  <span class="login-card-body">
                    <strong>${item.negocio}</strong>
                    <small>${item.nombre || "Emprendedor"}</small>
                    <span class="login-card-description">${descripcion}</span>
                    <span class="login-card-footer">
                      <span>${item.ubicacion || "Laboulaye"}</span>
                      <span class="login-card-action">${activeClass ? "Editando" : "Editar"}</span>
                    </span>
                  </span>
                </button>
              `
            })
            .join("")}
        </div>
      </section>
    `

    emprendimientosPanel.querySelectorAll("[data-profile-emprendimiento-id]").forEach((card) => {
      card.addEventListener("click", async () => {
        const id = Number(card.getAttribute("data-profile-emprendimiento-id"))
        await selectProfile(id)
      })
    })
  }

  async function loadProfile(id) {
    try {
      const data = await apiRequest(`emprendedores.php?id=${id}`)
      profile = data.emprendimiento
      populateForm()
      renderEmprendimientosPanel()
      if (message) {
        message.textContent = ""
        message.classList.remove("error")
      }
    } catch (error) {
      if (message) {
        message.textContent = error.message || "No se pudo cargar el emprendimiento seleccionado."
        message.classList.add("error")
      }
    }
  }

  async function selectProfile(id) {
    if (!id || (profile && Number(profile.id) === Number(id))) return

    if (message) {
      message.textContent = "Cargando emprendimiento..."
      message.classList.remove("error")
    }

    try {
      await rootRequest("select-emprendimiento.php", {
        method: "POST",
        body: JSON.stringify({ emprendimientoId: id }),
      })
      await loadProfile(id)
    } catch (error) {
      if (message) {
        message.textContent = error.message
        message.classList.add("error")
      }
    }
  }

  function syncProfileFromForm() {
    profile.negocio = getValue("profileNegocio")
    profile.nombre = getValue("profileNombre")
    profile.categoria = getValue("profileCategoria")
    profile.telefono = getValue("profileTelefono")
    profile.email = getValue("profileEmail")
    profile.ubicacion = getValue("profileUbicacion")
    profile.horarios = getValue("profileHorarios")
    profile.descripcion = getValue("profileDescripcion")
    profile.detalle = getValue("profileDetalle")
    profile.redesSociales = {
      instagram: getValue("profileInstagram"),
      facebook: getValue("profileFacebook"),
    }
    profile.imagen = profile.fotos[0] || ""
  }

  async function saveProfile() {
    syncProfileFromForm()
    try {
      const data = await apiRequest(`emprendedores.php?id=${profile.id}`, {
        method: "PUT",
        body: JSON.stringify(profile),
      })
      profile = data.emprendimiento
      emprendedoresDesdeDb = getEmprendedores().map((emp) => (emp.id === profile.id ? profile : emp))
      accountEmprendimientos = accountEmprendimientos.map((emp) => (Number(emp.id) === Number(profile.id) ? { ...emp, ...profile } : emp))
      populateForm()
      renderEmprendimientosPanel()
      if (message) {
        message.textContent = "Cambios guardados correctamente en MySQL."
        message.classList.remove("error")
      }
    } catch (error) {
      if (message) {
        message.textContent = error.message
        message.classList.add("error")
      }
    }
  }

  document.getElementById("addEspecialidadBtn")?.addEventListener("click", () => {
    const input = document.getElementById("newEspecialidad")
    const value = input.value.trim()
    if (!value) return
    profile.especialidades.push(value)
    input.value = ""
    renderEspecialidades()
  })

  document.getElementById("addFotoUrlBtn")?.addEventListener("click", () => {
    const input = document.getElementById("newFotoUrl")
    const value = input.value.trim()
    if (!value) return
    profile.fotos.push(value)
    input.value = ""
    renderFotos()
  })

  document.getElementById("profileFotoFile")?.addEventListener("change", async (event) => {
    try {
      if (message) {
        message.textContent = "Subiendo imagenes..."
        message.classList.remove("error")
      }
      const urls = await uploadImageFiles(event.target.files || [])
      profile.fotos.push(...urls)
      renderFotos()
      if (message) message.textContent = "Imagenes subidas correctamente."
    } catch (error) {
      if (message) {
        message.textContent = error.message
        message.classList.add("error")
      }
    } finally {
      event.target.value = ""
    }
  })

  document.getElementById("clearProfileBtn")?.addEventListener("click", () => {
    Object.assign(profile, {
      nombre: "",
      negocio: "",
      categoria: "gastronomia",
      descripcion: "",
      telefono: "",
      email: "",
      ubicacion: "",
      imagen: "",
      especialidades: [],
      detalle: "",
      horarios: "",
      redes: "",
      redesSociales: { instagram: "", facebook: "" },
      fotos: [],
    })
    populateForm()
    if (message) {
      message.textContent = "Datos eliminados de la pantalla. Presiona Guardar cambios para conservarlo."
      message.classList.remove("error")
    }
  })

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try {
      await apiRequest("logout.php", { method: "POST" })
    } catch (error) {
      console.warn("No se pudo cerrar la sesion en el servidor.", error)
    }
    window.location.href = "login.html"
  })

  form.addEventListener("submit", async (event) => {
    event.preventDefault()
    await saveProfile()
  })

  renderEmprendimientosPanel()
  if (description) {
    description.textContent = "Selecciona un emprendimiento del panel para editar sus datos."
  }
}

function initPageAnimations() {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  if (reduceMotion) return

  document.documentElement.classList.add("motion-ready")

  if (!("IntersectionObserver" in window) || !("MutationObserver" in window)) {
    return
  }

  const revealSelector = [
    ".page-hero",
    ".hero-card",
    ".home-hero-copy",
    ".home-hero-media",
    ".home-section-heading",
    ".home-process-list article",
    ".home-cta-inner",
    ".registro-card",
    ".auth-card",
    ".edit-profile-card",
    ".edit-section",
    ".form-section",
    ".emprendimiento-detail-hero",
    ".emprendimiento-detail-info > div",
    ".service-card",
    ".home-service-card",
    ".emprendedor-card",
    ".objective-card",
    ".entrepreneur-network-card",
    ".event-card",
    ".entrepreneur-event-card",
    ".selected-event-card",
    ".tool-card",
    ".tutorial-card",
    ".cert-card",
    ".cert-hero-card",
    ".finance-card",
    ".finance-summary-card",
    ".calculator-card",
    ".calendar-panel",
    ".digital-panel",
    ".school-course-option",
    ".login-emprendimiento-card",
  ].join(",")

  const staggerContainers = [
    ".services-grid",
    ".home-services-grid",
    ".emprendedores-grid",
    ".objectives-grid",
    ".entrepreneurs-grid",
    ".steps-grid",
    ".events-grid",
    ".entrepreneur-events-grid",
    ".tools-grid",
    ".tutorials-grid",
    ".benefits-grid-tools",
    ".cert-grid",
    ".cert-process-grid",
    ".finance-grid",
    ".school-course-grid",
    ".login-emprendimientos-grid",
  ].join(",")

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add("is-visible")
        observer.unobserve(entry.target)
      })
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
  )

  function decorateElement(element) {
    if (!(element instanceof Element) || element.dataset.motionReady === "true") return
    element.dataset.motionReady = "true"
    element.classList.add("reveal-on-scroll")
    observer.observe(element)
  }

  function decorateScope(scope = document) {
    if (scope instanceof Element && scope.matches(revealSelector)) {
      decorateElement(scope)
    }

    const elements = scope.querySelectorAll ? scope.querySelectorAll(revealSelector) : []
    elements.forEach(decorateElement)

    const containers = scope.querySelectorAll ? scope.querySelectorAll(staggerContainers) : []
    containers.forEach((container) => {
      Array.from(container.children).forEach((child, index) => {
        if (!(child instanceof HTMLElement)) return
        child.style.setProperty("--reveal-delay", `${Math.min(index, 7) * 70}ms`)
      })
    })
  }

  decorateScope()

  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) decorateScope(node)
      })
    })
  })

  mutationObserver.observe(document.body, { childList: true, subtree: true })
}

// Filtros de categorÃ­a
document.addEventListener("DOMContentLoaded", () => {
  initPageAnimations()

  // Cargar emprendedores
  cargarEmprendedores()
  cargarDetalleEmprendimiento()
  cargarEmprendedoresDesdeDb()
  initLogin()
  initAuthNav()
  initEditProfile()

  // Filtros de categorÃ­a
  const categoryButtons = document.querySelectorAll(".category-badge")
  categoryButtons.forEach((button) => {
    button.addEventListener("click", function () {
      categoryButtons.forEach((btn) => btn.classList.remove("active"))
      this.classList.add("active")
      const categoria = this.getAttribute("data-category")
      cargarEmprendedores(categoria)
    })
  })

  // Toggle password
  const toggleButtons = document.querySelectorAll(".toggle-password")
  toggleButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const targetId = this.getAttribute("data-target")
      const input = document.getElementById(targetId)
      if (input.type === "password") {
        input.type = "text"
      } else {
        input.type = "password"
      }
    })
  })

  // Formulario de registro
  const registroForm = document.getElementById("registroForm")
  const uploadArea = document.getElementById("uploadArea")
  const imageInput = document.getElementById("imagenes")
  const imagePreviewGrid = document.getElementById("imagePreviewGrid")
  let selectedImages = []

  function syncImageInput() {
    if (!imageInput) return

    const dataTransfer = new DataTransfer()
    selectedImages.forEach((file) => dataTransfer.items.add(file))
    imageInput.files = dataTransfer.files
  }

  function renderImagePreviews() {
    if (!imagePreviewGrid) return

    imagePreviewGrid.innerHTML = ""

    selectedImages.forEach((file, index) => {
      const previewItem = document.createElement("div")
      previewItem.className = "image-preview-item"

      const image = document.createElement("img")
      image.src = URL.createObjectURL(file)
      image.alt = file.name
      image.addEventListener("load", () => URL.revokeObjectURL(image.src), { once: true })

      const removeButton = document.createElement("button")
      removeButton.type = "button"
      removeButton.className = "image-preview-remove"
      removeButton.setAttribute("aria-label", `Quitar ${file.name}`)
      removeButton.textContent = "Ã—"
      removeButton.addEventListener("click", (event) => {
        event.stopPropagation()
        selectedImages.splice(index, 1)
        syncImageInput()
        renderImagePreviews()
      })

      const imageName = document.createElement("span")
      imageName.className = "image-preview-name"
      imageName.textContent = file.name

      previewItem.append(image, removeButton, imageName)
      imagePreviewGrid.appendChild(previewItem)
    })
  }

  function addImages(files) {
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"))

    images.forEach((file) => {
      const alreadySelected = selectedImages.some(
        (image) => image.name === file.name && image.size === file.size && image.lastModified === file.lastModified,
      )

      if (!alreadySelected) {
        selectedImages.push(file)
      }
    })

    syncImageInput()
    renderImagePreviews()
  }

  if (uploadArea && imageInput) {
    uploadArea.addEventListener("click", () => imageInput.click())

    uploadArea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        imageInput.click()
      }
    })

    imageInput.addEventListener("change", () => {
      addImages(imageInput.files)
    })

    ;["dragenter", "dragover"].forEach((eventName) => {
      uploadArea.addEventListener(eventName, (event) => {
        event.preventDefault()
        uploadArea.classList.add("drag-over")
      })
    })

    ;["dragleave", "drop"].forEach((eventName) => {
      uploadArea.addEventListener(eventName, (event) => {
        event.preventDefault()
        uploadArea.classList.remove("drag-over")
      })
    })

    uploadArea.addEventListener("drop", (event) => {
      addImages(event.dataTransfer.files)
    })
  }

  if (registroForm) {
    registroForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      const fechaNacimiento = new Date(document.getElementById("fechaNacimiento").value)
      const hoy = new Date()
      let edad = hoy.getFullYear() - fechaNacimiento.getFullYear()
      const mes = hoy.getMonth() - fechaNacimiento.getMonth()
      if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) edad -= 1

      const password = document.getElementById("password").value
      const confirmPassword = document.getElementById("confirmPassword").value
      const terminos = document.getElementById("terminos").checked

      if (edad < 18) {
        alert("Debes ser mayor de edad para registrarte")
        return
      }

      if (password !== confirmPassword) {
        alert("Las contraseÃ±as no coinciden")
        return
      }

      if (!terminos) {
        alert("Debes aceptar los tÃ©rminos y condiciones")
        return
      }

      const submitButton = registroForm.querySelector('button[type="submit"]')
      if (submitButton) {
        submitButton.disabled = true
        submitButton.textContent = "Guardando..."
      }

      try {
        if (submitButton && selectedImages.length) submitButton.textContent = "Subiendo imagenes..."
        const fotos = await uploadImageFiles(selectedImages)
        if (submitButton) submitButton.textContent = "Guardando..."
        const formData = new FormData(registroForm)
        const payload = Object.fromEntries(formData.entries())

        payload.tipoApoyo = getCheckedValues(registroForm, "tipoApoyo")
        payload.fotos = fotos

        await apiRequest("register.php", {
          method: "POST",
          body: JSON.stringify(payload),
        })

        alert("Registro guardado correctamente. Tu emprendimiento ya aparece en la vitrina.")
        window.location.href = "emprendedores.html"
      } catch (error) {
        alert(error.message)
      } finally {
        if (submitButton) {
          submitButton.disabled = false
          submitButton.textContent = "Registrar Emprendimiento"
        }
      }
    })
  }
})

// Panel de gestión de eventos (MongoDB mediante la API del servidor)
document.addEventListener("DOMContentLoaded", () => {
  const eventForm = document.getElementById("eventForm")
  if (!eventForm) return

  fetch("api/events.php?action=session", { credentials: "same-origin" })
    .then((response) => response.json())
    .then((session) => {
      if (!session.authenticated) window.location.replace("login.html")
    })
    .catch(() => window.location.replace("login.html"))

  const idInput = document.getElementById("eventId")
  const titleInput = document.getElementById("eventTitle")
  const dateInput = document.getElementById("eventDate")
  const timeInput = document.getElementById("eventTime")
  const placeInput = document.getElementById("eventPlace")
  const list = document.getElementById("eventList")
  const count = document.getElementById("eventCount")
  const message = document.getElementById("eventFormMessage")
  const submitButton = document.getElementById("eventSubmit")
  const cancelButton = document.getElementById("eventCancelEdit")

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;")

  const sortEvents = (events) => [...events].sort((first, second) => `${first.date}${first.time}`.localeCompare(`${second.date}${second.time}`))
  let events = []

  async function eventsRequest(method = "GET", data) {
    const response = await fetch("api/events.php", {
      method,
      credentials: "same-origin",
      headers: data ? { "Content-Type": "application/json" } : undefined,
      body: data ? JSON.stringify(data) : undefined,
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.ok === false) throw new Error(result.error || "No se pudo conectar con el calendario")
    return result
  }

  function resetForm() {
    eventForm.reset()
    idInput.value = ""
    submitButton.textContent = "Agregar evento"
    cancelButton.hidden = true
    message.textContent = ""
    titleInput.focus()
  }

  function renderEvents() {
    const sortedEvents = sortEvents(events)
    count.textContent = String(sortedEvents.length)

    if (!sortedEvents.length) {
      list.innerHTML = '<div class="event-empty-state"><strong>Aún no hay eventos</strong><span>Usá el formulario para cargar el primero.</span></div>'
      return
    }

    list.innerHTML = sortedEvents
      .map(
        (event) => `
          <article class="event-list-item">
            <div class="event-list-date"><strong>${escapeHtml(event.date.slice(8, 10))}</strong><span>${new Date(`${event.date}T00:00:00`).toLocaleDateString("es-AR", { month: "short" })}</span></div>
            <div class="event-list-content">
              <h3>${escapeHtml(event.title)}</h3>
              <p>${escapeHtml(event.time)} hs${event.place ? ` · ${escapeHtml(event.place)}` : ""}</p>
            </div>
            <div class="event-list-actions">
              <button class="event-action edit" type="button" data-event-edit="${escapeHtml(event.id)}">Editar</button>
              <button class="event-action delete" type="button" data-event-delete="${escapeHtml(event.id)}">Eliminar</button>
            </div>
          </article>
        `,
      )
      .join("")
  }

  eventForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    const eventData = {
      title: titleInput.value.trim(),
      date: dateInput.value,
      time: timeInput.value,
      place: placeInput.value.trim(),
      type: "Evento",
    }

    try {
      submitButton.disabled = true
      if (idInput.value) {
        await eventsRequest("PUT", { ...eventData, id: idInput.value })
        message.textContent = "Evento actualizado correctamente."
      } else {
        await eventsRequest("POST", eventData)
        message.textContent = "Evento agregado al calendario."
      }
      events = (await eventsRequest()).events || []
      renderEvents()
      const feedback = message.textContent
      resetForm()
      message.textContent = feedback
    } catch (error) {
      message.textContent = error.message
    } finally {
      submitButton.disabled = false
    }
  })

  list.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-event-edit]")
    const deleteButton = event.target.closest("[data-event-delete]")
    const eventId = editButton?.dataset.eventEdit || deleteButton?.dataset.eventDelete
    if (!eventId) return

    const selectedEvent = events.find((item) => item.id === eventId)
    if (!selectedEvent) return

    if (editButton) {
      idInput.value = selectedEvent.id
      titleInput.value = selectedEvent.title
      dateInput.value = selectedEvent.date
      timeInput.value = selectedEvent.time
      placeInput.value = selectedEvent.place || ""
      submitButton.textContent = "Guardar cambios"
      cancelButton.hidden = false
      message.textContent = "Editando evento seleccionado."
      titleInput.focus()
      return
    }

    if (window.confirm(`¿Eliminar el evento “${selectedEvent.title}”?`)) {
      eventsRequest("DELETE", { id: selectedEvent.id })
        .then(() => eventsRequest())
        .then((result) => {
          events = result.events || []
          if (idInput.value === selectedEvent.id) resetForm()
          renderEvents()
          message.textContent = "Evento eliminado."
        })
        .catch((error) => {
          message.textContent = error.message
        })
    }
  })

  cancelButton.addEventListener("click", resetForm)
  document.getElementById("eventAdminLogout")?.addEventListener("click", async () => {
    try {
      await fetch("api/events.php?action=logout", { method: "POST", credentials: "same-origin" })
    } finally {
      window.location.replace("login.html")
    }
  })

  eventsRequest()
    .then((result) => {
      events = result.events || []
      renderEvents()
    })
    .catch((error) => {
      message.textContent = error.message
    })
})

// Calendario de eventos de la ciudad
document.addEventListener("DOMContentLoaded", () => {
  const calendarGrid = document.getElementById("cityCalendar")
  const monthLabel = document.getElementById("calendarMonthLabel")
  const todayLabel = document.getElementById("calendarTodayLabel")
  const selectedTitle = document.getElementById("selectedDateTitle")
  const selectedEvents = document.getElementById("selectedCityEvents")
  const prevButton = document.getElementById("prevCalendarMonth")
  const nextButton = document.getElementById("nextCalendarMonth")
  const entrepreneurGrid = document.getElementById("entrepreneurEventsGrid")

  if (!calendarGrid || !monthLabel || !selectedTitle || !selectedEvents) return

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const formatDateKey = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const dateFromOffset = (days) => {
    const date = new Date(today)
    date.setDate(today.getDate() + days)
    return date
  }

  const formatFullDate = (date) =>
    date.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })

  const cityEvents = []
  const entrepreneurEvents = []

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;")

  let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  let selectedDateKey = formatDateKey(today)

  function getEventsForDate(dateKey) {
    return cityEvents.filter((event) => event.date === dateKey)
  }

  function renderSelectedEvents(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`)
    const events = getEventsForDate(dateKey)

    selectedTitle.textContent = formatFullDate(date)

    if (!events.length) {
      selectedEvents.innerHTML = `
        <div class="empty-event-state">
          No hay eventos cargados para este dÃ­a.
        </div>
      `
      return
    }

    selectedEvents.innerHTML = events
      .map(
        (event) => `
          <article class="selected-event-card">
            <span>${escapeHtml(event.type || "Evento")}</span>
            <h4>${escapeHtml(event.title)}</h4>
            <p>${escapeHtml(event.time)} hs${event.place ? ` · ${escapeHtml(event.place)}` : ""}</p>
          </article>
        `,
      )
      .join("")
  }

  function renderCalendar() {
    const year = visibleMonth.getFullYear()
    const month = visibleMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()

    monthLabel.textContent = visibleMonth.toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric",
    })

    const cells = []

    for (let index = 0; index < firstDay; index++) {
      cells.push('<div class="calendar-day empty"></div>')
    }

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day)
      const dateKey = formatDateKey(date)
      const events = getEventsForDate(dateKey)
      const classNames = ["calendar-day"]

      if (dateKey === formatDateKey(today)) classNames.push("is-today")
      if (dateKey === selectedDateKey) classNames.push("is-selected")
      if (events.length) classNames.push("has-event")

      cells.push(`
        <button class="${classNames.join(" ")}" type="button" data-date="${dateKey}">
          <span class="calendar-day-number">${day}</span>
          ${events.length ? `<span class="calendar-event-dot">${events.length}</span>` : ""}
        </button>
      `)
    }

    calendarGrid.innerHTML = cells.join("")

    calendarGrid.querySelectorAll("[data-date]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedDateKey = button.getAttribute("data-date")
        renderCalendar()
        renderSelectedEvents(selectedDateKey)
      })
    })
  }

  function renderEntrepreneurEvents() {
    if (!entrepreneurGrid) return

    entrepreneurGrid.innerHTML = entrepreneurEvents
      .map(
        (event) => `
          <article class="entrepreneur-event-card">
            <div class="entrepreneur-event-date">
              <strong>${event.date.getDate()}</strong>
              <span>${event.date.toLocaleDateString("es-AR", { month: "short" })}</span>
              <small>${event.date.getFullYear()}</small>
            </div>
            <div>
              <span class="badge">${event.badge}</span>
              <h3>${event.title}</h3>
              <p>${event.description}</p>
            </div>
          </article>
        `,
      )
      .join("")
  }

  prevButton?.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
    renderCalendar()
  })

  nextButton?.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)
    renderCalendar()
  })

  if (todayLabel) {
    todayLabel.textContent = `Hoy: ${formatFullDate(today)}`
  }

  renderCalendar()
  renderSelectedEvents(selectedDateKey)
  renderEntrepreneurEvents()

  fetch("api/events.php", { credentials: "same-origin" })
    .then((response) => response.json())
    .then((result) => {
      if (!result.ok) throw new Error(result.error || "No se pudo cargar el calendario")
      cityEvents.splice(0, cityEvents.length, ...(Array.isArray(result.events) ? result.events : []))
      renderCalendar()
      renderSelectedEvents(selectedDateKey)
    })
    .catch(() => {
      // La interfaz sigue mostrando el estado vacío si el servidor aún no configuró MongoDB.
    })
})

document.addEventListener("DOMContentLoaded", () => {
  const mobileMenuBtn = document.getElementById("mobileMenuBtn")
  const navLinks = document.getElementById("navLinks") || document.querySelector(".nav-links")

  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("mobile-open")
      mobileMenuBtn.setAttribute("aria-expanded", String(isOpen))
    })
  }

  const toolCards = Array.from(document.querySelectorAll(".tool-card"))
  const toolButtons = Array.from(document.querySelectorAll("[data-tool-filter]"))
  const toolSearch = document.getElementById("toolSearch")
  const emptyToolsMessage = document.getElementById("emptyToolsMessage")

  function normalizeText(value) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  }

  function filterTools() {
    if (!toolCards.length) return

    const activeFilter = document.querySelector("[data-tool-filter].active")?.getAttribute("data-tool-filter") || "todas"
    const searchTerm = normalizeText(toolSearch?.value || "")
    let visibleCount = 0

    toolCards.forEach((card) => {
      const category = card.getAttribute("data-category")
      const text = normalizeText(card.getAttribute("data-tool-text") || card.textContent)
      const matchesFilter = activeFilter === "todas" || category === activeFilter
      const matchesSearch = !searchTerm || text.includes(searchTerm)
      const isVisible = matchesFilter && matchesSearch

      card.classList.toggle("is-hidden", !isVisible)
      if (isVisible) visibleCount += 1
    })

    if (emptyToolsMessage) {
      emptyToolsMessage.classList.toggle("is-visible", visibleCount === 0)
    }
  }

  toolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      toolButtons.forEach((item) => item.classList.remove("active"))
      button.classList.add("active")
      filterTools()
    })
  })

  if (toolSearch) {
    toolSearch.addEventListener("input", filterTools)
  }

  const calculator = document.getElementById("priceCalculator")

  if (calculator) {
    calculator.addEventListener("submit", (event) => {
      event.preventDefault()

      const cost = Number.parseFloat(document.getElementById("costInput").value)
      const margin = Number.parseFloat(document.getElementById("marginInput").value)
      const units = Number.parseInt(document.getElementById("unitsInput").value, 10)
      const result = document.getElementById("calculatorResult")

      if (!result) return

      if (!cost || cost <= 0 || Number.isNaN(margin) || margin < 0 || !units || units <= 0) {
        result.textContent = "Ingresa valores validos para calcular el precio."
        return
      }

      const unitCost = cost / units
      const suggestedPrice = unitCost * (1 + margin / 100)

      result.textContent = `Precio sugerido por unidad: $${suggestedPrice.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    })
  }

  const certificationCards = Array.from(document.querySelectorAll("[data-cert-category]"))
  const certificationButtons = Array.from(document.querySelectorAll("[data-cert-filter]"))

  function filterCertifications() {
    if (!certificationCards.length) return

    const activeFilter = document.querySelector("[data-cert-filter].active")?.getAttribute("data-cert-filter") || "todas"

    certificationCards.forEach((card) => {
      const category = card.getAttribute("data-cert-category")
      card.classList.toggle("is-hidden", activeFilter !== "todas" && category !== activeFilter)
    })
  }

  certificationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      certificationButtons.forEach((item) => item.classList.remove("active"))
      button.classList.add("active")
      filterCertifications()
    })
  })

  const certChecks = Array.from(document.querySelectorAll(".cert-check"))
  const certProgressBar = document.getElementById("certProgressBar")
  const certProgressText = document.getElementById("certProgressText")

  function updateCertificationProgress() {
    if (!certChecks.length || !certProgressBar || !certProgressText) return

    const completed = certChecks.filter((check) => check.checked).length
    const total = certChecks.length
    const percentage = (completed / total) * 100

    certProgressBar.style.width = `${percentage}%`
    certProgressText.textContent = `${completed} de ${total} requisitos listos`
  }

  certChecks.forEach((check) => {
    check.addEventListener("change", updateCertificationProgress)
  })

  updateCertificationProgress()

  const financeCards = Array.from(document.querySelectorAll("[data-finance-category]"))
  const financeButtons = Array.from(document.querySelectorAll("[data-finance-filter]"))

  function filterFinanceCards() {
    if (!financeCards.length) return

    const activeFilter = document.querySelector("[data-finance-filter].active")?.getAttribute("data-finance-filter") || "todas"

    financeCards.forEach((card) => {
      const category = card.getAttribute("data-finance-category")
      card.classList.toggle("is-hidden", activeFilter !== "todas" && category !== activeFilter)
    })
  }

  financeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      financeButtons.forEach((item) => item.classList.remove("active"))
      button.classList.add("active")
      filterFinanceCards()
    })
  })

  const financeCalculator = document.getElementById("financeCalculator")

  if (financeCalculator) {
    financeCalculator.addEventListener("submit", (event) => {
      event.preventDefault()

      const amount = Number.parseFloat(document.getElementById("financeAmount").value)
      const months = Number.parseInt(document.getElementById("financeMonths").value, 10)
      const annualRate = Number.parseFloat(document.getElementById("financeRate").value)
      const result = document.getElementById("financeResult")

      if (!result) return

      if (!amount || amount <= 0 || !months || months <= 0 || Number.isNaN(annualRate) || annualRate < 0) {
        result.textContent = "Ingresa valores validos para simular la cuota."
        return
      }

      const monthlyRate = annualRate / 100 / 12
      const payment =
        monthlyRate === 0
          ? amount / months
          : (amount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)

      result.textContent = `Cuota estimada: $${payment.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} por mes`
    })
  }

  const escuelaForm = document.getElementById("escuelaForm")

  if (escuelaForm) {
    escuelaForm.addEventListener("submit", (event) => {
      event.preventDefault()

      const selectedCourses = escuelaForm.querySelectorAll('input[name="cursosEscuela"]:checked')

      if (!selectedCourses.length) {
        alert("Selecciona al menos un curso de la Escuela Emprendedora")
        return
      }

      alert("Inscripcion enviada. Te contactaremos con la informacion de los cursos seleccionados.")
      escuelaForm.reset()
    })
  }
})

