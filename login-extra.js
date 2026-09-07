(function () {
  async function jsonRequest(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.ok === false) throw new Error(data.error || "No se pudo completar la operacion")
    return data
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm")
    const message = document.getElementById("loginMessage")
    if (!form) return

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault()
        event.stopImmediatePropagation()

        if (message) {
          message.textContent = "Ingresando..."
          message.classList.remove("error")
        }

        try {
          await jsonRequest("api/login.php", {
            method: "POST",
            body: JSON.stringify({
              usuario: document.getElementById("loginUsuario")?.value.trim() || "",
              password: document.getElementById("loginPassword")?.value || "",
            }),
          })

          if (message) message.textContent = "Ingresaste correctamente. Abriendo tu panel..."
          window.location.replace("editprofile.html")
        } catch (error) {
          if (message) {
            message.textContent = error.message
            message.classList.add("error")
          }
        }
      },
      true,
    )

    jsonRequest("api/session.php")
      .then((session) => {
        if (session.authenticated) {
          window.location.replace("editprofile.html")
        }
      })
      .catch(() => {})
  })
})()
