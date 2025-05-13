document.addEventListener("DOMContentLoaded", () => {
  // Get the correct scrollable elements
  const chatContainer = document.getElementById("chat-container")
  const chatMessages = document.getElementById("chat-messages")
  const promptInput = document.getElementById("prompt")
  const submitButton = document.getElementById("submit-btn")
  const formOverlay = document.createElement("div")

  // Create form overlay
  formOverlay.className = "form-overlay"
  formOverlay.style.display = "none"
  document.body.appendChild(formOverlay)

  // List of document types
  const documentTypes = [
    "barangay clearance",
    "barangay indigency",
    "barangay indengency",
    "barangay indengecy",
    "indigency",
    "barangay residency",
    "residency",
    "clearance",
  ]

  // List of interrogative words (5Ws and H)
  const interrogativeWords = [
    "what",
    "where",
    "when",
    "why",
    "who",
    "how",
    "is",
    "are",
    "can",
    "could",
    "would",
    "should",
    "do",
    "does",
    "did",
  ]

  // Enhanced robust auto-scroll function
  function scrollToBottom() {
    // Log for debugging
    console.log("Scrolling to bottom")
    console.log("Container height:", chatContainer.clientHeight)
    console.log("Scroll height:", chatContainer.scrollHeight)

    // Force layout recalculation
    void chatContainer.offsetHeight

    // Set scroll position immediately
    chatContainer.scrollTop = chatContainer.scrollHeight

    // Use requestAnimationFrame for smoother scrolling
    requestAnimationFrame(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight
    })

    // Also try with multiple delays for reliability
    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight
    }, 10)

    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight
      console.log("Final scroll position:", chatContainer.scrollTop)
    }, 100)
  }

  // Set up auto-scrolling with MutationObserver
  function setupAutoScroll() {
    // Create a MutationObserver to watch for changes in the chat container
    const observer = new MutationObserver((mutations) => {
      scrollToBottom()
    })

    // Start observing the chat container for DOM changes
    observer.observe(chatMessages, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    })

    // Also set up interval-based scrolling for a short period after content changes
    let scrollInterval
    const startScrollInterval = () => {
      clearInterval(scrollInterval)
      let scrollCount = 0
      scrollInterval = setInterval(() => {
        scrollToBottom()
        scrollCount++
        if (scrollCount > 5) {
          clearInterval(scrollInterval)
        }
      }, 100)
    }

    // Watch for changes to trigger the interval-based scrolling
    const contentObserver = new MutationObserver(() => {
      startScrollInterval()
    })

    contentObserver.observe(chatMessages, {
      childList: true,
      subtree: true,
    })

    // Add resize observer to handle window resizing
    const resizeObserver = new ResizeObserver(() => {
      scrollToBottom()
    })
    resizeObserver.observe(chatContainer)

    // Force scroll on image load to handle dynamic content height changes
    document.querySelectorAll("img").forEach((img) => {
      img.addEventListener("load", scrollToBottom)
    })
  }

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

    // Force scroll after adding a message
    scrollToBottom()
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

    // Check if the prompt contains a document type (more flexible detection)
    const containsDocumentType = documentTypes.some((docType) => prompt.toLowerCase().includes(docType))

    // Check if the prompt contains the word "document" (for general document inquiries)
    const containsDocumentWord = prompt.toLowerCase().includes("document")

    // Check if the prompt contains interrogative words
    const containsInterrogative = interrogativeWords.some((word) =>
      prompt
        .toLowerCase()
        .split(/\s+/)
        .some((w) => w === word),
    )

    // Check if the prompt starts with interrogative words or phrases
    const startsWithInterrogative =
      interrogativeWords.some((word) => prompt.toLowerCase().startsWith(word)) ||
      prompt.toLowerCase().startsWith("how can") ||
      prompt.toLowerCase().startsWith("how do") ||
      prompt.toLowerCase().startsWith("how to") ||
      prompt.toLowerCase().startsWith("what is") ||
      prompt.toLowerCase().startsWith("where can") ||
      prompt.toLowerCase().startsWith("when can")

    // Determine if this is a direct document request - more lenient conditions
    // BUT make sure it's not an interrogative question
    const isDirectDocumentRequest =
      containsDocumentType &&
      !startsWithInterrogative &&
      (prompt.toLowerCase().includes("request") ||
        prompt.toLowerCase().includes("form") ||
        prompt.toLowerCase().includes("get") ||
        prompt.toLowerCase().includes("apply") ||
        prompt.toLowerCase().includes("need") ||
        prompt.toLowerCase().startsWith("i want") ||
        prompt.toLowerCase().startsWith("i need") ||
        // Also consider it a direct request if it just mentions the document without questions
        !containsInterrogative)

    // Detect which document type was requested
    let requestedDocType = null
    if (containsDocumentType) {
      // Find the matching document type
      for (const docType of documentTypes) {
        if (prompt.toLowerCase().includes(docType)) {
          // Map to one of the standard document types
          if (docType.includes("clearance")) {
            requestedDocType = "barangay clearance"
          } else if (docType.includes("indeng") || docType.includes("indige") || docType === "indigency") {
            requestedDocType = "barangay indigency"
          } else if (docType.includes("resid") || docType === "residency") {
            requestedDocType = "barangay residency"
          }
          break
        }
      }
    }

    fetch("/get_response", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        isDirectDocumentRequest: isDirectDocumentRequest,
        containsDocumentType: containsDocumentType,
        containsDocumentWord: containsDocumentWord,
        containsInterrogative: containsInterrogative,
        startsWithInterrogative: startsWithInterrogative,
        requestedDocType: requestedDocType,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.response === "ADMIN_AUTHENTICATED") {
          window.location.href = "/admin"
        } else {
          const result = data.response ? data.response : data.error || "No response content found."
          addMessage(result)

          // Force scroll after adding AI response
          scrollToBottom()

          // Check if we need to show a form
          if (data.showForm && data.formType) {
            showDocumentForm(data.formType)
            // Force scroll after showing form
            scrollToBottom()
          }

          // If the AI suggests a form, add a button to show it
          if (data.suggestForm && data.formType) {
            addFormSuggestionButton(data.formType)
            // Force scroll after adding form suggestion
            scrollToBottom()
          }

          // If the AI suggests all document types
          if (data.suggestAllDocuments) {
            addAllDocumentsSuggestion()
            // Force scroll after adding document suggestions
            scrollToBottom()
          }
        }
      })
      .catch((error) => {
        addMessage("Error: Unable to fetch response.")
        console.error("Error:", error)
        // Force scroll after error message
        scrollToBottom()
      })
      .finally(() => {
        setSubmitButtonState(true)
        // Final force scroll
        scrollToBottom()
      })
  }

  // Function to suggest a specific document form
  function addFormSuggestionButton(documentType) {
    const suggestionDiv = document.createElement("div")
    suggestionDiv.className = "form-suggestion"
    suggestionDiv.innerHTML = `
    <p><strong>Document Request Available:</strong> I can help you request a ${documentType.charAt(0).toUpperCase() + documentType.slice(1)}.</p>
    <button class="form-suggestion-btn">Open Request Form</button>
  `

    const button = suggestionDiv.querySelector(".form-suggestion-btn")
    button.addEventListener("click", () => {
      showDocumentForm(documentType)
      suggestionDiv.remove()
      // Force scroll after removing suggestion
      scrollToBottom()
    })

    chatMessages.appendChild(suggestionDiv)
    // Force scroll after adding suggestion
    scrollToBottom()
  }

  // Function to suggest all three document types
  function addAllDocumentsSuggestion() {
    const suggestionDiv = document.createElement("div")
    suggestionDiv.className = "all-documents-suggestion"
    suggestionDiv.innerHTML = `
      <p><strong>Available Document Requests:</strong> I can help you request any of the following documents:</p>
      <div class="document-buttons">
        <button class="document-btn" data-type="barangay clearance">Barangay Clearance</button>
        <button class="document-btn" data-type="barangay indigency">Barangay Indigency</button>
        <button class="document-btn" data-type="barangay residency">Barangay Residency</button>
      </div>
      <p class="document-help-text">Click on any document to open its request form.</p>
    `

    // Add event listeners to all buttons
    const buttons = suggestionDiv.querySelectorAll(".document-btn")
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const docType = button.getAttribute("data-type")
        showDocumentForm(docType)
        suggestionDiv.remove()
        // Force scroll after removing suggestion
        scrollToBottom()
      })
    })

    chatMessages.appendChild(suggestionDiv)
    // Force scroll after adding suggestions
    scrollToBottom()
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
      // Force scroll after closing form
      scrollToBottom()
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
            // Force scroll after success message
            scrollToBottom()
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

  // Set up auto-scrolling
  setupAutoScroll()

  // Initial scroll to bottom
  scrollToBottom()

  // Force scroll on window resize to handle layout shifts
  window.addEventListener("resize", scrollToBottom)
})
