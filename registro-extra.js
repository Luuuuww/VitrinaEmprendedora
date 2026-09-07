(function () {
  const apiRequestLocal = async (path, options = {}) => {
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.ok === false) throw new Error(data.error || "No se pudo completar la operacion")
    return data
  }

  const setValue = (id, value) => {
    const field = document.getElementById(id)
    if (field) field.value = value || ""
  }

  const setRadio = (name, value) => {
    if (!value) return
    const field = document.querySelector(`input[name="${name}"][value="${value}"]`)
    if (field) field.checked = true
  }

  const uploadImageFilesLocal = async (files) => {
    const imageFiles = Array.from(files || [])
    if (!imageFiles.length) return []

    const formData = new FormData()
    imageFiles.forEach((file) => formData.append("imagenes[]", file))

    const response = await fetch("api/upload-image.php", {
      method: "POST",
      credentials: "same-origin",
      body: formData,
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok || data.ok === false) throw new Error(data.error || "No se pudieron subir las imagenes")
    return Array.isArray(data.urls) ? data.urls : []
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registroForm")
    if (!form) return

    const accountFields = document.getElementById("accountLookupFields")
    const newAccountSection = document.getElementById("newAccountSection")
    const message = document.getElementById("accountLookupMessage")
    const loadButton = document.getElementById("loadAccountDataBtn")
    const descripcion = document.getElementById("descripcionEmprendimiento")
    const counter = document.getElementById("descripcionCounter")
    const submitButton = form.querySelector('button[type="submit"]')

    function usesExistingAccount() {
      return document.querySelector('input[name="tieneCuentaEmprendedor"]:checked')?.value === "si"
    }

    function updateAccountMode() {
      const existing = usesExistingAccount()
      if (accountFields) accountFields.hidden = !existing
      if (newAccountSection) newAccountSection.hidden = existing
      ;["password", "confirmPassword"].forEach((id) => {
        const field = document.getElementById(id)
        if (!field) return
        field.required = !existing
        field.disabled = existing
        if (existing) field.value = ""
      })
    }

    function updateCounter() {
      if (!descripcion || !counter) return
      counter.textContent = String(descripcion.value.length)
    }

    document.querySelectorAll('input[name="tieneCuentaEmprendedor"]').forEach((radio) => {
      radio.addEventListener("change", updateAccountMode)
    })

    descripcion?.addEventListener("input", updateCounter)
    updateAccountMode()
    updateCounter()

    loadButton?.addEventListener("click", async () => {
      if (message) {
        message.textContent = "Cargando datos..."
        message.classList.remove("error")
      }

      try {
        const data = await apiRequestLocal("account-data.php", {
          method: "POST",
          body: JSON.stringify({
            usuario: document.getElementById("cuentaUsuario")?.value.trim() || "",
            password: document.getElementById("cuentaPassword")?.value || "",
          }),
        })

        const fields = data.fields || {}
        setValue("nombreApellido", fields.nombreApellido)
        setValue("dni", fields.dni)
        setValue("fechaNacimiento", fields.fechaNacimiento)
        setValue("domicilioParticular", fields.domicilioParticular)
        setValue("telefono", fields.telefono)
        setValue("email", fields.email || data.usuario)
        setValue("cuitCuil", fields.cuitCuil)
        setRadio("estadoActual", fields.estadoActual)
        setRadio("condicionFiscal", fields.condicionFiscal)
        setRadio("inscripcionIIBB", fields.inscripcionIIBB)

        if (message) message.textContent = "Datos cargados. Ahora completa el nuevo emprendimiento."
      } catch (error) {
        if (message) {
          message.textContent = error.message
          message.classList.add("error")
        }
      }
    })

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault()
        event.stopImmediatePropagation()

        const fechaNacimiento = new Date(document.getElementById("fechaNacimiento")?.value || "")
        const hoy = new Date()
        let edad = hoy.getFullYear() - fechaNacimiento.getFullYear()
        const mes = hoy.getMonth() - fechaNacimiento.getMonth()
        if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) edad -= 1

        if (!Number.isFinite(edad) || edad < 18) {
          alert("Debes ser mayor de edad para registrarte")
          return
        }

        if ((descripcion?.value.length || 0) > 250) {
          alert("La descripcion breve no puede superar los 250 caracteres")
          return
        }

        if (!usesExistingAccount()) {
          const password = document.getElementById("password")?.value || ""
          const confirmPassword = document.getElementById("confirmPassword")?.value || ""
          if (password !== confirmPassword) {
            alert("Las contrasenas no coinciden")
            return
          }
        }

        if (!document.getElementById("terminos")?.checked) {
          alert("Debes aceptar los terminos y condiciones")
          return
        }

        if (submitButton) {
          submitButton.disabled = true
          submitButton.textContent = "Guardando..."
        }

        try {
          const imageInput = document.getElementById("imagenes")
          if (submitButton && imageInput?.files?.length) submitButton.textContent = "Subiendo imagenes..."
          const fotos = await uploadImageFilesLocal(imageInput?.files || [])
          if (submitButton) submitButton.textContent = "Guardando..."
          const formData = new FormData(form)
          const payload = Object.fromEntries(formData.entries())
          payload.tipoApoyo = Array.from(form.querySelectorAll('input[name="tipoApoyo"]:checked')).map((input) => input.value)
          payload.fotos = fotos

          await apiRequestLocal("api/register.php", {
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
      },
      true,
    )
  })
})()
