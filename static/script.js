document.addEventListener("DOMContentLoaded", () => {
  const chatMessages = document.getElementById("chat-messages")
  const promptInput = document.getElementById("prompt")
  const submitButton = document.getElementById("submit-btn")
  const formOverlay = document.createElement("div")

  // Create form overlay
  formOverlay.className = "form-overlay"
  formOverlay.style.display = "none"
  document.body.appendChild(formOverlay)

  function addMessage(content, isUser = false) {
    const messageDiv = document.createElement("div")
    messageDiv.classList.add("message")
    messageDiv.classList.add(isUser ? "user-message" : "ai-message")

    if (isUser) {
      messageDiv.textContent = content
    } else {
      messageDiv.innerHTML = content // Use innerHTML to render the HTML formatting
    }

    chatMessages.appendChild(messageDiv)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }

  function setSubmitButtonState(enabled) {
    submitButton.disabled = !enabled
    submitButton.style.opacity = enabled ? "1" : "0.5"
  }

  function handleSubmit() {
    const prompt = promptInput.value.trim()
    if (!prompt) return

    addMessage(prompt, true)
    promptInput.value = ""
    setSubmitButtonState(false)

    fetch("/get_response", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: prompt }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.response === "ADMIN_AUTHENTICATED") {
          window.location.href = "/admin"
        } else {
          const result = data.response ? data.response : data.error || "No response content found."
          addMessage(result)

          // Check if we need to show a form
          if (data.showForm && data.formType) {
            showDocumentForm(data.formType)
          }
        }
      })
      .catch((error) => {
        addMessage("Error: Unable to fetch response.")
        console.error("Error:", error)
      })
      .finally(() => {
        setSubmitButtonState(true)
      })
  }

  function showDocumentForm(documentType) {
    // Clear any existing form
    formOverlay.innerHTML = ""

    // Create form container
    const formContainer = document.createElement("div")
    formContainer.className = "document-form-container"

    // Create form title
    const formTitle = document.createElement("h2")
    formTitle.textContent = documentType.charAt(0).toUpperCase() + documentType.slice(1) + " Request Form"

    // Create form
    const form = document.createElement("form")
    form.id = "documentForm"
    form.className = "document-form"

    // Add common fields
    form.innerHTML = `
      <div class="form-group">
        <label for="date">Date:</label>
        <input type="date" id="date" name="date" required value="${new Date().toISOString().split("T")[0]}">
      </div>
      
      <div class="form-group">
        <label for="name">Full Name:</label>
        <input type="text" id="name" name="name" required placeholder="Enter your full name">
      </div>
      
      <div class="form-group">
        <label for="purok">Purok:</label>
        <input type="text" id="purok" name="purok" required placeholder="Enter your purok number">
      </div>
      
      <div class="form-group">
        <label for="purpose">Purpose/Remarks:</label>
        <textarea id="purpose" name="purpose" required placeholder="Enter the purpose of this document request"></textarea>
      </div>
    `

    // Add document-specific fields
    if (documentType === "barangay indigency") {
      const copiesField = document.createElement("div")
      copiesField.className = "form-group"
      copiesField.innerHTML = `
        <label for="copies">No. of pcs.:</label>
        <input type="number" id="copies" name="copies" required min="1" value="1">
      `
      form.appendChild(copiesField)
    }

    // Add submit button
    const submitBtn = document.createElement("button")
    submitBtn.type = "submit"
    submitBtn.className = "form-submit-btn"
    submitBtn.textContent = "Submit Request"
    form.appendChild(submitBtn)

    // Add close button
    const closeBtn = document.createElement("button")
    closeBtn.type = "button"
    closeBtn.className = "form-close-btn"
    closeBtn.textContent = "×"
    closeBtn.addEventListener("click", () => {
      formOverlay.style.display = "none"
    })

    // Assemble form
    formContainer.appendChild(closeBtn)
    formContainer.appendChild(formTitle)
    formContainer.appendChild(form)
    formOverlay.appendChild(formContainer)

    // Show form
    formOverlay.style.display = "flex"

    // Handle form submission
    form.addEventListener("submit", (e) => {
      e.preventDefault()

      // Collect form data
      const formData = {
        documentType: documentType,
        date: document.getElementById("date").value,
        name: document.getElementById("name").value,
        purok: document.getElementById("purok").value,
        purpose: document.getElementById("purpose").value,
      }

      // Add document-specific fields
      if (documentType === "barangay indigency") {
        formData.copies = document.getElementById("copies").value
      }

      // Submit form data
      fetch("/submit_document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            // Hide form
            formOverlay.style.display = "none"

            // Show success message
            addMessage(data.response)
          } else {
            alert("Error: " + (data.error || "Failed to submit form"))
          }
        })
        .catch((error) => {
          alert("Error: Unable to submit form")
          console.error("Error:", error)
        })
    })
  }

  submitButton.addEventListener("click", handleSubmit)

  promptInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  })

  promptInput.addEventListener("input", () => {
    setSubmitButtonState(promptInput.value.trim().length > 0)
  })

  // Initial button state
  setSubmitButtonState(false)

  // Initial AI message - removed document type information
  addMessage(`
    <div class="ai-response" style="text-align: justify; line-height: 1.6;">
      <p>Hello! I'm BAAC (Barangay Amungan Assistant Chatbot). How can I help you today?</p>
      <p>Feel free to ask me any questions about Barangay Amungan or request assistance with barangay services.</p>
    </div>
  `)

  // Team member hover effect
  const teamMembers = document.querySelectorAll(".team-member")

  teamMembers.forEach((member) => {
    member.addEventListener("mouseenter", () => {
      member.querySelector(".member-info").style.transform = "translateY(-100%)"
    })

    member.addEventListener("mouseleave", () => {
      member.querySelector(".member-info").style.transform = "translateY(0)"
    })
  })
})
