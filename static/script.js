// Global variables
let chatMessages
let userInput
let sendButton
let typingIndicator
let currentChatId = null
let formOverlay
let chatList
let chats = []
let isMobile = window.innerWidth <= 768

// Initialize the chat interface
document.addEventListener("DOMContentLoaded", () => {
  // Get the correct scrollable elements
  const chatContainer = document.getElementById("chat-container")
  chatMessages = document.getElementById("chat-messages")
  const promptInput = document.getElementById("prompt")
  const submitButton = document.getElementById("submit-btn")
  formOverlay = document.createElement("div")

  // Chat history elements
  const chatSidebar = document.getElementById("chat-history-panel")
  chatList = document.getElementById("chat-history-list")
  const newChatBtn = document.getElementById("newChatBtn")
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn")
  const currentChatTitle = document.getElementById("currentChatTitle")
  const renameChatBtn = document.getElementById("renameChatBtn")
  const deleteChatBtn = document.getElementById("deleteChatBtn")

  // Rename chat modal elements
  const renameChatModal = document.getElementById("renameChatModal")
  const closeRenameChatModal = document.getElementById("closeRenameChatModal")
  const chatTitleInput = document.getElementById("chatTitle")
  const saveChatTitleBtn = document.getElementById("saveChatTitleBtn")

  // Delete chat modal elements
  const deleteChatModal = document.getElementById("deleteChatModal")
  const closeDeleteChatModal = document.getElementById("closeDeleteChatModal")
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn")
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn")

  // Create form overlay
  formOverlay.className = "form-overlay"
  formOverlay.style.display = "none"
  document.body.appendChild(formOverlay)

  // Document types configuration
  const documentTypes = [
    {
      id: "barangay-clearance",
      name: "barangay clearance",
      displayName: "Barangay Clearance",
      icon: "📋",
      description: "Certificate of good moral character",
      color: "#e53935",
    },
    {
      id: "barangay-residency",
      name: "barangay residency",
      displayName: "Barangay Residency",
      icon: "🏠",
      description: "Proof of residence certificate",
      color: "#1976d2",
    },
    {
      id: "barangay-indigency",
      name: "barangay indigency",
      displayName: "Barangay Indigency",
      icon: "📄",
      description: "Financial assistance certificate",
      color: "#388e3c",
    },
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
    "ano",
    "sino",
    "saan",
    "pano",
    "papaano",
    "anya",
    "bakit",
    "ang",
    "Ania",
    "Asino",
    "Ayan",
    "Kaano",
    "Apay",
    "Kasano",
    "Manu",
    "Ayri",
    "Ayti",
    "Anya",
    "Anta",
    "Ongkot",
    "Hino",
    "Nakano",
    "Makano",
  ]

  // Function to check if user is logged in
  function isUserLoggedIn() {
    return (
      document.body.classList.contains("user-logged-in") ||
      document.querySelector(".user-info") !== null ||
      document.querySelector('[data-user-logged-in="true"]') !== null ||
      document.getElementById("user-dropdown") !== null
    )
  }

  // Enhanced robust auto-scroll function
  function scrollToBottom() {
    console.log("Scrolling to bottom")
    void chatContainer.offsetHeight
    chatContainer.scrollTop = chatContainer.scrollHeight

    requestAnimationFrame(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight
    })

    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight
    }, 10)

    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight
    }, 100)
  }

  // Set up auto-scrolling with MutationObserver

  function setupAutoScroll() {
    const observer = new MutationObserver(() => {
      scrollToBottom()
    })

    observer.observe(chatMessages, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    })

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

    const contentObserver = new MutationObserver(() => {
      startScrollInterval()
    })

    contentObserver.observe(chatMessages, {
      childList: true,
      subtree: true,
    })

    const resizeObserver = new ResizeObserver(() => {
      scrollToBottom()
    })
    resizeObserver.observe(chatContainer)

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
      messageDiv.innerHTML = content
    }

    chatMessages.appendChild(messageDiv)
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

    // Check if the prompt contains a document type
    const containsDocumentType = documentTypes.some((docType) => prompt.toLowerCase().includes(docType.name))

    const containsDocumentWord = prompt.toLowerCase().includes("document")
    const containsInterrogative = interrogativeWords.some((word) =>
      prompt
        .toLowerCase()
        .split(/\s+/)
        .some((w) => w === word),
    )

    const startsWithInterrogative =
      interrogativeWords.some((word) => prompt.toLowerCase().startsWith(word)) ||
      prompt.toLowerCase().startsWith("how can") ||
      prompt.toLowerCase().startsWith("how do") ||
      prompt.toLowerCase().startsWith("how to") ||
      prompt.toLowerCase().startsWith("what is") ||
      prompt.toLowerCase().startsWith("where can") ||
      prompt.toLowerCase().startsWith("when can")

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
        !containsInterrogative)

    let requestedDocType = null
    if (containsDocumentType) {
      for (const docType of documentTypes) {
        if (prompt.toLowerCase().includes(docType.name)) {
          requestedDocType = docType.name
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
        chat_id: currentChatId,
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

          if (currentChatId && chats.length > 0) {
            const currentChat = chats.find((chat) => chat.id === currentChatId)
            if (currentChat && currentChat.title === "New Chat") {
              const newTitle = prompt.length > 30 ? prompt.substring(0, 30) + "..." : prompt
              updateChatTitle(currentChatId, newTitle)
            }
          }

          scrollToBottom()

          if (data.showFormButton && data.formType) {
            // AI provided a button to show the form
          }

          if (data.suggestForm && data.formType) {
            addFormSuggestionButton(data.formType)
            scrollToBottom()
          }

          if (data.suggestAllDocuments) {
            addAllDocumentsSuggestion()
            scrollToBottom()
          }

          if (data.requiresAuth && data.documentType) {
            addAuthRequiredMessage(data.documentType)
            scrollToBottom()
          }
        }
      })
      .catch((error) => {
        addMessage("Error: Unable to fetch response.")
        console.error("Error:", error)
        scrollToBottom()
      })
      .finally(() => {
        setSubmitButtonState(true)
        scrollToBottom()

        if (currentChatId) {
          loadChats()
        }
      })
  }

  // Function to add authentication required message
  function addAuthRequiredMessage(documentType) {
    const authMessage = document.createElement("div")
    authMessage.className = "auth-required-message"
    authMessage.innerHTML = `
      <div style="background: linear-gradient(135deg, #ffebee 0%, #ffffff 100%); border: 2px solid #ef5350; border-radius: 8px; padding: 20px; margin: 15px 0; box-shadow: 0 4px 12px rgba(239, 83, 80, 0.15);">
        <p style="margin: 0 0 12px 0; color: #c62828; font-weight: 600; font-size: 16px;"><strong>🔐 Authentication Required</strong></p>
        <p style="margin: 0 0 20px 0; color: #d32f2f; line-height: 1.5;">You need to be logged in to request a ${documentType.charAt(0).toUpperCase() + documentType.slice(1)}.</p>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <button onclick="window.location.href='/login'" style="background: linear-gradient(135deg, #ef5350 0%, #c62828 100%); color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; transition: transform 0.2s ease, box-shadow 0.2s ease; box-shadow: 0 2px 8px rgba(239, 83, 80, 0.3);">🔑 Login</button>
          <button onclick="window.location.href='/register'" style="background: linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%); color: #c62828; border: 2px solid #ef5350; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; transition: transform 0.2s ease;">📝 Sign Up</button>
        </div>
      </div>
    `
    chatMessages.appendChild(authMessage)
    scrollToBottom()
  }

  // Function to suggest a specific document form
  function addFormSuggestionButton(documentType) {
    if (!isUserLoggedIn()) {
      addAuthRequiredMessage(documentType)
      return
    }

    const suggestionDiv = document.createElement("div")
    suggestionDiv.className = "form-suggestion"
    suggestionDiv.innerHTML = `
      <div style="background: linear-gradient(135deg, #ffebee 0%, #ffffff 100%); border: 2px solid #ef5350; border-radius: 12px; padding: 20px; margin: 15px 0; box-shadow: 0 6px 20px rgba(239, 83, 80, 0.15);">
        <p style="margin: 0 0 12px 0; color: #c62828; font-weight: 600; font-size: 16px;"><strong>📋 Document Request Available</strong></p>
        <p style="margin: 0 0 20px 0; color: #d32f2f; line-height: 1.5;">I can help you request a ${documentType.charAt(0).toUpperCase() + documentType.slice(1)}.</p>
        <div style="text-align: center;">
          <button class="form-suggestion-btn" style="background: linear-gradient(135deg, #ef5350 0%, #c62828 100%); color: white; border: none; padding: 14px 28px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 15px; transition: transform 0.2s ease, box-shadow 0.2s ease; box-shadow: 0 4px 12px rgba(239, 83, 80, 0.3);">📄 Open Request Form</button>
        </div>
      </div>
    `

    const button = suggestionDiv.querySelector(".form-suggestion-btn")
    button.addEventListener("click", () => {
      showDocumentForm([documentType])
      suggestionDiv.remove()
      scrollToBottom()
    })

    chatMessages.appendChild(suggestionDiv)
    scrollToBottom()
  }

  // Function to suggest all three document types
  function addAllDocumentsSuggestion() {
    const suggestionDiv = document.createElement("div")
    suggestionDiv.className = "all-documents-suggestion"

    const userLoggedIn = isUserLoggedIn()

    if (userLoggedIn) {
      suggestionDiv.innerHTML = `
        <div style="background: linear-gradient(135deg, #ffebee 0%, #ffffff 100%); border: 2px solid #ef5350; border-radius: 12px; padding: 20px; margin: 15px 0; box-shadow: 0 6px 20px rgba(239, 83, 80, 0.15);">
          <p style="margin: 0 0 15px 0; color: #c62828; font-weight: 600; font-size: 16px;"><strong>📋 Available Document Requests</strong></p>
          <p style="margin: 0 0 20px 0; color: #d32f2f; line-height: 1.5;">I can help you request any of the following documents:</p>
          <div class="document-buttons" style="display: flex; flex-direction: column; gap: 12px;">
            ${documentTypes
              .map(
                (docType) => `
              <button class="document-btn" data-type="${docType.name}" style="background: linear-gradient(135deg, ${docType.color} 0%, ${adjustColor(docType.color, -20)} 100%); color: white; border: none; padding: 14px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 15px; transition: transform 0.2s ease, box-shadow 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 18px;">${docType.icon}</span>
                <div style="text-align: left; flex: 1;">
                  <div style="font-weight: 700;">${docType.displayName}</div>
                  <div style="font-size: 12px; opacity: 0.9;">${docType.description}</div>
                </div>
              </button>
            `,
              )
              .join("")}
          </div>
          <p style="margin: 20px 0 0 0; font-size: 14px; color: #666; text-align: center; font-style: italic;">Click on any document to open the request form, or select multiple documents at once.</p>
        </div>
      `

      const buttons = suggestionDiv.querySelectorAll(".document-btn")
      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          const docType = button.getAttribute("data-type")
          showDocumentForm([docType])
          suggestionDiv.remove()
          scrollToBottom()
        })
      })
    } else {
      suggestionDiv.innerHTML = `
        <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffffff 100%); border: 2px solid #ff9800; border-radius: 12px; padding: 20px; margin: 15px 0; box-shadow: 0 6px 20px rgba(255, 152, 0, 0.15);">
          <p style="margin: 0 0 12px 0; color: #e65100; font-weight: 600; font-size: 16px;"><strong>📋 Available Document Requests</strong></p>
          <p style="margin: 0 0 12px 0; color: #f57c00; line-height: 1.5;">I can help you request Barangay Clearance, Barangay Indigency, and Barangay Residency documents.</p>
          <p style="color: #d32f2f; font-weight: 600; margin: 0 0 20px 0; font-size: 15px;">⚠️ However, you need to be logged in to submit document requests.</p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button onclick="window.location.href='/login'" style="background: linear-gradient(135deg, #ef5350 0%, #c62828 100%); color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">🔑 Login</button>
            <button onclick="window.location.href='/register'" style="background: linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%); color: #c62828; border: 2px solid #ef5350; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">📝 Sign Up</button>
          </div>
        </div>
      `
    }

    chatMessages.appendChild(suggestionDiv)
    scrollToBottom()
  }

  // Enhanced document form with multiple document selection
  function showDocumentForm(preselectedTypes = []) {
    if (!isUserLoggedIn()) {
      addAuthRequiredMessage(preselectedTypes[0] || "documents")
      return
    }

    formOverlay.innerHTML = ""

    const formContainer = document.createElement("div")
    formContainer.className = "enhanced-document-form-container"
    formContainer.style.cssText = `
      background: white;
      border-radius: 20px;
      max-width: 1000px;
      width: 95%;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
      position: relative;
      display: flex;
      border: 3px solid #ffcdd2;
    `

    // Create document selector sidebar
    const sidebarContainer = document.createElement("div")
    sidebarContainer.className = "document-selector-sidebar"
    sidebarContainer.style.cssText = `
      width: 300px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-right: 2px solid #dee2e6;
      padding: 0;
      overflow-y: auto;
      position: relative;
    `

    // Sidebar header
    const sidebarHeader = document.createElement("div")
    sidebarHeader.style.cssText = `
      background: linear-gradient(135deg, #ef5350 0%, #c62828 100%);
      color: white;
      padding: 20px;
      text-align: center;
      position: sticky;
      top: 0;
      z-index: 10;
    `
    sidebarHeader.innerHTML = `
      <h3 style="margin: 0; font-size: 18px; font-weight: 700;">📋 Select Documents</h3>
      <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">Choose one or more documents to request</p>
    `

    // Document bookmarks
    const bookmarksContainer = document.createElement("div")
    bookmarksContainer.className = "document-bookmarks"
    bookmarksContainer.style.cssText = `
      padding: 20px 15px;
    `

    const selectedDocuments = new Set()

    // Only add preselected types if they exist and are valid
    if (preselectedTypes && Array.isArray(preselectedTypes)) {
      preselectedTypes.forEach((type) => {
        if (type && documentTypes.some((dt) => dt.name === type)) {
          selectedDocuments.add(type)
        }
      })
    }

    documentTypes.forEach((docType, index) => {
      const bookmark = document.createElement("div")
      bookmark.className = "document-bookmark"
      bookmark.dataset.docType = docType.name

      const isSelected = selectedDocuments.has(docType.name)

      bookmark.style.cssText = `
        background: ${isSelected ? `linear-gradient(135deg, ${docType.color} 0%, ${adjustColor(docType.color, -20)} 100%)` : "white"};
        color: ${isSelected ? "white" : "#333"};
        border: 2px solid ${docType.color};
        border-radius: 15px;
        padding: 15px;
        margin-bottom: 12px;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
        box-shadow: ${isSelected ? `0 6px 20px ${docType.color}40` : "0 2px 8px rgba(0,0,0,0.1)"};
        transform: ${isSelected ? "translateX(5px)" : "translateX(0)"};
      `

      bookmark.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 24px;">${docType.icon}</div>
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">${docType.displayName}</div>
            <div style="font-size: 12px; opacity: 0.8;">${docType.description}</div>
          </div>
          <div class="checkbox-indicator" style="
            width: 24px;
            height: 24px;
            border: 2px solid ${isSelected ? "white" : docType.color};
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${isSelected ? "rgba(255,255,255,0.2)" : "transparent"};
          ">
            ${isSelected ? '<span style="color: white; font-weight: bold; font-size: 16px;">✓</span>' : ""}
          </div>
        </div>
      `

      bookmark.addEventListener("click", () => {
        if (selectedDocuments.has(docType.name)) {
          selectedDocuments.delete(docType.name)
          bookmark.style.background = "white"
          bookmark.style.color = "#333"
          bookmark.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"
          bookmark.style.transform = "translateX(0)"
          bookmark.querySelector(".checkbox-indicator").innerHTML = ""
          bookmark.querySelector(".checkbox-indicator").style.background = "transparent"
          bookmark.querySelector(".checkbox-indicator").style.borderColor = docType.color
        } else {
          selectedDocuments.add(docType.name)
          bookmark.style.background = `linear-gradient(135deg, ${docType.color} 0%, ${adjustColor(docType.color, -20)} 100%)`
          bookmark.style.color = "white"
          bookmark.style.boxShadow = `0 6px 20px ${docType.color}40`
          bookmark.style.transform = "translateX(5px)"
          bookmark.querySelector(".checkbox-indicator").innerHTML =
            '<span style="color: white; font-weight: bold; font-size: 16px;">✓</span>'
          bookmark.querySelector(".checkbox-indicator").style.background = "rgba(255,255,255,0.2)"
          bookmark.querySelector(".checkbox-indicator").style.borderColor = "white"
        }
        updateFormContent()
        updateSubmitButton()
      })

      bookmarksContainer.appendChild(bookmark)
    })

    sidebarContainer.appendChild(sidebarHeader)
    sidebarContainer.appendChild(bookmarksContainer)

    // Create main form area
    const mainFormArea = document.createElement("div")
    mainFormArea.className = "main-form-area"
    mainFormArea.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `

    // Form header
    const formHeader = document.createElement("div")
    formHeader.style.cssText = `
      background: linear-gradient(135deg, #ef5350 0%, #c62828 100%);
      color: white;
      padding: 20px 30px;
      position: relative;
    `
    formHeader.innerHTML = `
      <h2 style="margin: 0; font-size: 24px; font-weight: 700;">📄 Document Request Form</h2>
      <p style="margin: 8px 0 0 0; opacity: 0.95; font-size: 14px;">Fill out your information and submit your requests</p>
    `

    // Close button
    const closeBtn = document.createElement("button")
    closeBtn.className = "form-close-btn"
    closeBtn.innerHTML = "×"
    closeBtn.style.cssText = `
      position: absolute;
      top: 15px;
      right: 20px;
      background: rgba(255,255,255,0.2);
      border: none;
      font-size: 28px;
      cursor: pointer;
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      transition: all 0.2s ease;
    `
    closeBtn.addEventListener("click", () => {
      formOverlay.style.display = "none"
      scrollToBottom()
    })

    formHeader.appendChild(closeBtn)

    // Form content area
    const formContent = document.createElement("div")
    formContent.className = "form-content-area"
    formContent.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 30px;
      background: linear-gradient(135deg, #fafafa 0%, #ffffff 100%);
    `

    // Common fields section
    const commonFieldsSection = document.createElement("div")
    commonFieldsSection.className = "common-fields-section"
    commonFieldsSection.innerHTML = `
  <div style="margin-bottom: 30px;">
    <h3 style="margin: 0 0 20px 0; color: #c62828; font-size: 20px; font-weight: 600; border-bottom: 2px solid #ffcdd2; padding-bottom: 10px;">
      📅 Request Details
    </h3>

    <div>
      <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #c62828; font-size: 15px;">
        Date of Request:
      </label>
      <input 
        type="date" 
        id="form-date" 
        required 
        value="${new Date().toISOString().split("T")[0]}" 
        style="width: 100%; padding: 12px; border: 2px solid #ffcdd2; border-radius: 8px; font-size: 16px;"
      >
    </div>
  </div>
`
    // Dynamic forms container
    const dynamicFormsContainer = document.createElement("div")
    dynamicFormsContainer.className = "dynamic-forms-container"
    dynamicFormsContainer.id = "dynamicFormsContainer"

    // Submit button
    const submitBtn = document.createElement("button")
    submitBtn.type = "submit"
    submitBtn.className = "enhanced-submit-btn"
    submitBtn.style.cssText = `
      width: 100%;
      padding: 18px;
      background: linear-gradient(135deg, #ef5350 0%, #c62828 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 18px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 30px;
      transition: all 0.3s ease;
      box-shadow: 0 6px 20px rgba(239, 83, 80, 0.3);
      text-transform: uppercase;
      letter-spacing: 1px;
    `

    // Function to create document-specific form
    function createDocumentSpecificForm(docType) {
      const docConfig = documentTypes.find((dt) => dt.name === docType)
      if (!docConfig) return null

      const formSection = document.createElement("div")
      formSection.className = "document-specific-form"
      formSection.id = `form-${docConfig.id}`
      formSection.style.cssText = `
        background: white;
        border: 2px solid ${docConfig.color};
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      `

      const specificFields = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid ${docConfig.color}20;">
          <span style="font-size: 28px;">${docConfig.icon}</span>
          <div>
            <h4 style="margin: 0; color: ${docConfig.color}; font-size: 20px; font-weight: 700;">${docConfig.displayName}</h4>
            <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">${docConfig.description}</p>
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: ${docConfig.color}; font-size: 15px;">📝 Purpose/Remarks:</label>
          <textarea id="purpose-${docConfig.id}" required placeholder="Enter the purpose of this ${docConfig.displayName} request" 
                    style="width: 100%; padding: 12px; border: 2px solid ${docConfig.color}40; border-radius: 8px; font-size: 16px; min-height: 100px; resize: vertical; transition: all 0.3s ease; font-family: inherit;"></textarea>
        </div>

        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: ${docConfig.color}; font-size: 15px;">📑 Number of Copies:</label>
          <input type="number" id="copies-${docConfig.id}" min="1" max="10" value="1"
                 style="width: 100%; padding: 12px; border: 2px solid ${docConfig.color}40; border-radius: 8px; font-size: 16px; transition: all 0.3s ease;">
          <small style="color: #666; font-size: 13px; margin-top: 5px; display: block;">Maximum of 10 copies per request</small>
        </div>
      `

      formSection.innerHTML = specificFields
      return formSection
    }

    // Function to update form content based on selected documents
    function updateFormContent() {
      dynamicFormsContainer.innerHTML = ""

      Array.from(selectedDocuments).forEach((docType) => {
        const formSection = createDocumentSpecificForm(docType)
        if (formSection) {
          dynamicFormsContainer.appendChild(formSection)
        }
      })
    }

    // Function to update submit button with proper logic
    function updateSubmitButton() {
      const count = selectedDocuments.size

      if (count === 0) {
        submitBtn.textContent = ""
        submitBtn.disabled = true
        submitBtn.style.background = "linear-gradient(135deg, #bdbdbd 0%, #757575 100%)"
        submitBtn.style.cursor = "not-allowed"
      } else {
        submitBtn.disabled = false
        submitBtn.style.background = "linear-gradient(135deg, #ef5350 0%, #c62828 100%)"
        submitBtn.style.cursor = "pointer"

        if (count === 1) {
          submitBtn.textContent = "📤 Submit Request"
        } else {
          submitBtn.textContent = `📤 Submit ${count} Requests`
        }
      }
    }

    // Assemble the form
    formContent.appendChild(commonFieldsSection)
    formContent.appendChild(dynamicFormsContainer)
    formContent.appendChild(submitBtn)

    mainFormArea.appendChild(formHeader)
    mainFormArea.appendChild(formContent)

    formContainer.appendChild(sidebarContainer)
    formContainer.appendChild(mainFormArea)
    formOverlay.appendChild(formContainer)

    // Initialize form
    updateFormContent()
    updateSubmitButton()

    // Show form overlay
    formOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      backdrop-filter: blur(8px);
    `

    // Handle form submission - Fixed to correctly map document types to copy counts
    submitBtn.addEventListener("click", async (e) => {
      e.preventDefault()

      if (selectedDocuments.size === 0) {
        alert("Please select at least one document type")
        return
      }

      // Get common data
      const dateElement = formContent.querySelector("#form-date")
      const dateValue = dateElement ? dateElement.value.trim() : ""

      if (!dateValue) {
        alert("Please select a date")
        return
      }

      // Prepare purpose and copies for each document
      const purposeValues = {}
      let copyC = 0,
        copyI = 0,
        copyR = 0

      for (const docType of selectedDocuments) {
        const docConfig = documentTypes.find((dt) => dt.name === docType)
        if (!docConfig) continue

        // Purpose field
        const purposeElement = formContent.querySelector(`#purpose-${docConfig.id}`)
        if (!purposeElement || !purposeElement.value.trim()) {
          alert(`Please fill in the purpose for ${docConfig.displayName}`)
          return
        }
        purposeValues[docType] = purposeElement.value.trim()

        const copiesElement = formContent.querySelector(`#copies-${docConfig.id}`)
        const copiesValue = copiesElement ? Number.parseInt(copiesElement.value) || 1 : 1

        if (docType === "barangay clearance") copyC = copiesValue
        else if (docType === "barangay indigency") copyI = copiesValue
        else if (docType === "barangay residency") copyR = copiesValue
      }

      // Disable submit button
      submitBtn.disabled = true
      submitBtn.textContent = "⏳ Submitting Requests..."
      submitBtn.style.background = "linear-gradient(135deg, #bdbdbd 0%, #757575 100%)"

      try {
        // Combine purposes into a single string (semicolon-separated)
        const combinedPurpose = Object.values(purposeValues).join("; ")

        const formData = {
          document_types: Array.from(selectedDocuments), // plain array of strings
          date: dateValue,
          purpose: combinedPurpose, // send as string instead of object
          copyC: copyC,
          copyI: copyI,
          copyR: copyR,
        }

        if (currentChatId) formData.chat_id = currentChatId

        console.log("[v0] Submitting document request:", formData)

        const response = await fetch("/submit_document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`)
        }

        const result = await response.json()

        if (result.success) {
          formOverlay.style.display = "none"
          addMessage(result.response)
          scrollToBottom()
        } else {
          alert("Error: " + (result.error || result.message || "Failed to submit document request"))
        }
      } catch (error) {
        console.error("[v0] Error submitting document request:", error)
        alert("Error: Unable to submit document request. " + error.message)
      } finally {
        submitBtn.disabled = false
        updateSubmitButton()
      }
    })
  }

  // Helper function to adjust color brightness
  function adjustColor(color, amount) {
    const usePound = color[0] === "#"
    const col = usePound ? color.slice(1) : color
    const num = Number.parseInt(col, 16)
    let r = (num >> 16) + amount
    let g = ((num >> 8) & 0x00ff) + amount
    let b = (num & 0x0000ff) + amount
    r = r > 255 ? 255 : r < 0 ? 0 : r
    g = g > 255 ? 255 : g < 0 ? 0 : g
    b = b > 255 ? 255 : b < 0 ? 0 : b
    return (usePound ? "#" : "") + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")
  }

  // Make showDocumentForm globally accessible
  window.showDocumentForm = showDocumentForm

  // Chat History Functions
  function loadChats() {
    if (!chatList) {
      console.error("Chat list element not found")
      return
    }

    fetch("/user/chats")
      .then((response) => response.json())
      .then((data) => {
        chats = data.chats || []
        renderChatList()
      })
      .catch((error) => {
        console.error("Error loading chats:", error)
        if (chatList) {
          chatList.innerHTML = '<div class="empty-chats">Error loading chats. Please try again.</div>'
        }
      })
  }

  function renderChatList() {
    if (!chatList) return

    if (chats.length === 0) {
      chatList.innerHTML = `
        <div class="empty-chats">
          <p>No chat history found.</p>
          <p>Start a new conversation to create your first chat.</p>
        </div>
      `
      return
    }

    chatList.innerHTML = ""

    chats.forEach((chat) => {
      const chatItem = document.createElement("div")
      chatItem.className = "chat-item"
      chatItem.id = `chat-${chat.id}`
      chatItem.dataset.chatId = chat.id

      if (chat.id === currentChatId) {
        chatItem.classList.add("active")
      }

      const chatDate = new Date(chat.updated_at)
      const today = new Date()
      let dateText = ""

      if (chatDate.toDateString() === today.toDateString()) {
        dateText = chatDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      } else if (chatDate.getFullYear() === today.getFullYear()) {
        dateText = chatDate.toLocaleDateString([], { month: "short", day: "numeric" })
      } else {
        dateText = chatDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
      }

      chatItem.innerHTML = `
        <div class="chat-item-content">
          <div class="chat-title">${chat.title}</div>
          <div class="chat-item-date">${dateText}</div>
        </div>
        <div class="chat-actions">
          <button class="rename-chat-btn" title="Rename Chat">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button class="delete-chat-btn" title="Delete Chat">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `

      chatItem.addEventListener("click", (e) => {
        if (!e.target.closest(".chat-actions")) {
          loadChat(chat.id)
        }
      })

      const renameBtn = chatItem.querySelector(".rename-chat-btn")
      if (renameBtn) {
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation()
          window.renameChat(chat.id)
        })
      }

      const deleteBtn = chatItem.querySelector(".delete-chat-btn")
      if (deleteBtn) {
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation()
          window.deleteChat(chat.id)
        })
      }

      chatList.appendChild(chatItem)
    })
  }

  function createNewChat() {
    fetch("/user/chats/new", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "New Chat" }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          chatMessages.innerHTML = ""
          currentChatId = data.chat_id

          if (currentChatTitle) {
            currentChatTitle.textContent = data.title
            currentChatTitle.dataset.chatId = data.chat_id
          }

          addMessage(`
            <div class="ai-response" style="text-align: justify; line-height: 1.6;">
              <p>Hello! I'm BAAC (Barangay Amungan Assistant Chatbot). How can I help you today?</p>
              <p>Feel free to ask any questions about Barangay Amungan or request assistance with barangay services.</p>
            </div>
          `)

          loadChats()
        } else {
          alert("Error: " + (data.error || "Failed to create new chat"))
        }
      })
      .catch((error) => {
        console.error("Error creating new chat:", error)
        alert("Error creating new chat. Please try again.")
      })
  }

  function loadChat(chatId) {
    currentChatId = chatId

    const chat = chats.find((c) => c.id === chatId)
    if (chat) {
      if (currentChatTitle) {
        currentChatTitle.textContent = chat.title
        currentChatTitle.dataset.chatId = chatId
      }
    }

    const chatItems = document.querySelectorAll(".chat-item")
    chatItems.forEach((item) => {
      item.classList.remove("active")
      if (item.dataset.chatId == chatId) {
        item.classList.add("active")
      }
    })

    chatMessages.innerHTML = ""

    fetch(`/user/chats/${chatId}/messages`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.messages && data.messages.length > 0) {
          data.messages.forEach((message) => {
            addMessage(message.message, message.is_user)
          })
        } else {
          addMessage(`
            <div class="ai-response" style="text-align: justify; line-height: 1.6;">
              <p>Hello! I'm BAAC (Barangay Amungan Assistant Chatbot). How can I help you today?</p>
              <p>Feel free to ask any questions about Barangay Amungan or request assistance with barangay services.</p>
            </div>
          `)
        }

        if (isMobile && chatSidebar) {
          chatSidebar.classList.remove("active")
          const overlay = document.querySelector(".sidebar-overlay")
          if (overlay) {
            overlay.classList.remove("active")
          }
        }
      })
      .catch((error) => {
        console.error("Error loading chat messages:", error)
        addMessage("Error loading chat messages. Please try again.")
      })
  }

  function updateChatTitle(chatId, newTitle) {
    if (!newTitle || newTitle.trim() === "") return

    fetch(`/user/chats/${chatId}/rename`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: newTitle.trim() }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          if (currentChatId === chatId && currentChatTitle) {
            currentChatTitle.textContent = newTitle.trim()
          }

          const chatItem = document.getElementById(`chat-${chatId}`)
          if (chatItem) {
            const titleElement = chatItem.querySelector(".chat-title")
            if (titleElement) {
              titleElement.textContent = newTitle.trim()
            }
          }

          const chatIndex = chats.findIndex((c) => c.id === chatId)
          if (chatIndex !== -1) {
            chats[chatIndex].title = newTitle.trim()
          }

          showNotification("Chat renamed successfully", "success")
        } else {
          showNotification(data.error || "Failed to rename chat", "error")
        }
      })
      .catch((error) => {
        console.error("Error renaming chat:", error)
        showNotification("An error occurred while renaming the chat", "error")
      })
  }

  // Event Listeners
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

  // Chat history event listeners
  if (newChatBtn) {
    newChatBtn.addEventListener("click", createNewChat)
  }

  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener("click", () => {
      if (chatSidebar) {
        chatSidebar.classList.toggle("active")

        if (isMobile) {
          let overlay = document.querySelector(".sidebar-overlay")

          if (!overlay) {
            overlay = document.createElement("div")
            overlay.className = "sidebar-overlay"
            document.body.appendChild(overlay)

            overlay.addEventListener("click", () => {
              chatSidebar.classList.remove("active")
              overlay.classList.remove("active")
            })
          }

          if (chatSidebar.classList.contains("active")) {
            overlay.classList.add("active")
          } else {
            overlay.classList.remove("active")
          }
        }
      }
    })
  }

  if (renameChatBtn) {
    renameChatBtn.addEventListener("click", () => {
      if (currentChatId) {
        window.renameChat(currentChatId)
      } else {
        showNotification("Please select a chat first", "error")
      }
    })
  }

  if (closeRenameChatModal) {
    closeRenameChatModal.addEventListener("click", () => {
      renameChatModal.style.display = "none"
    })
  }

  if (saveChatTitleBtn) {
    saveChatTitleBtn.addEventListener("click", () => {
      const chatId = Number.parseInt(renameChatModal.dataset.chatId)
      const newTitle = chatTitleInput.value.trim()

      if (newTitle && chatId) {
        updateChatTitle(chatId, newTitle)
        renameChatModal.style.display = "none"
      } else {
        showNotification("Please enter a valid title", "error")
      }
    })
  }

  if (deleteChatBtn) {
    deleteChatBtn.addEventListener("click", () => {
      if (currentChatId) {
        window.deleteChat(currentChatId)
      } else {
        showNotification("Please select a chat first", "error")
      }
    })
  }

  if (closeDeleteChatModal) {
    closeDeleteChatModal.addEventListener("click", () => {
      deleteChatModal.style.display = "none"
    })
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
      deleteChatModal.style.display = "none"
    })
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", () => {
      const chatId = Number.parseInt(deleteChatModal.dataset.chatId)
      if (chatId) {
        window.performDeleteChat(chatId)
        deleteChatModal.style.display = "none"
      }
    })
  }

  if (chatTitleInput) {
    chatTitleInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        saveChatTitleBtn.click()
      }
    })
  }

  window.addEventListener("resize", () => {
    isMobile = window.innerWidth <= 768
  })

  // Initial setup
  setSubmitButtonState(false)

  addMessage(`
    <div class="ai-response" style="text-align: justify; line-height: 1.6;">
      <p>Hello! I'm BAAC (Barangay Amungan Assistant Chatbot). How can I help you today?</p>
      <p>Feel free to ask any questions about Barangay Amungan or request assistance with barangay services.</p>
    </div>
  `)

  setupAutoScroll()
  scrollToBottom()

  window.addEventListener("resize", scrollToBottom)

  if (chatList) {
    loadChats()
    if (!currentChatId) {
      createNewChat()
    }
  }
})

// Global functions
function showNotification(message, type = "info") {
  const notification = document.createElement("div")
  notification.className = `notification ${type}`
  notification.textContent = message

  document.body.appendChild(notification)

  setTimeout(() => {
    notification.classList.add("show")
  }, 10)

  setTimeout(() => {
    notification.classList.remove("show")
    setTimeout(() => {
      notification.remove()
    }, 300)
  }, 3000)
}

window.isUserLoggedIn = () =>
  document.body.classList.contains("user-logged-in") ||
  document.querySelector(".user-info") !== null ||
  document.querySelector('[data-user-logged-in="true"]') !== null ||
  document.getElementById("user-dropdown") !== null

window.renameChat = (chatId) => {
  let currentTitle = ""
  const chatItem = document.getElementById(`chat-${chatId}`)
  if (chatItem) {
    const titleElement = chatItem.querySelector(".chat-title")
    if (titleElement) {
      currentTitle = titleElement.textContent
    }
  }

  if (document.getElementById("renameChatModal")) {
    document.getElementById("chatTitle").value = currentTitle
    document.getElementById("renameChatModal").dataset.chatId = chatId
    document.getElementById("renameChatModal").style.display = "block"
    document.getElementById("chatTitle").focus()
  } else {
    const newTitle = prompt("Enter a new title for this chat:", currentTitle)
    if (newTitle && newTitle.trim() !== "") {
      window.updateChatTitle(chatId, newTitle)
    }
  }
}

window.deleteChat = (chatId) => {
  if (document.getElementById("deleteChatModal")) {
    document.getElementById("deleteChatModal").dataset.chatId = chatId
    document.getElementById("deleteChatModal").style.display = "block"
  } else {
    if (confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
      window.performDeleteChat(chatId)
    }
  }
}

window.performDeleteChat = (chatId) => {
  fetch(`/user/chats/${chatId}/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const chatItem = document.getElementById(`chat-${chatId}`)
        if (chatItem) {
          chatItem.remove()
        }

        if (window.chats) {
          window.chats = window.chats.filter((c) => c.id !== chatId)
        }

        if (window.currentChatId === chatId) {
          document.getElementById("chat-messages").innerHTML = ""
          window.currentChatId = null
          if (document.getElementById("currentChatTitle")) {
            document.getElementById("currentChatTitle").textContent = "New Chat"
            document.getElementById("currentChatTitle").dataset.chatId = ""
          }
          window.createNewChat()
        }

        showNotification("Chat deleted successfully", "success")
      } else {
        showNotification(data.error || "Failed to delete chat", "error")
      }
    })
    .catch((error) => {
      console.error("Error deleting chat:", error)
      showNotification("An error occurred while deleting the chat", "error")
    })
}

// Add enhanced notification styles
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("enhanced-notification-styles")) {
    const style = document.createElement("style")
    style.id = "enhanced-notification-styles"
    style.textContent = `
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        opacity: 0;
        transform: translateY(-20px);
        transition: opacity 0.3s, transform 0.3s;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-weight: 600;
      }
      
      .notification.show {
        opacity: 1;
        transform: translateY(0);
      }
      
      .notification.success {
        background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%);
      }
      
      .notification.error {
        background: linear-gradient(135deg, #ef5350 0%, #c62828 100%);
      }
      
      .notification.info {
        background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
      }
      
      .chat-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 18px;
        border-bottom: 1px solid rgba(239, 83, 80, 0.1);
        cursor: pointer;
        transition: background-color 0.2s;
        border-radius: 8px;
        margin: 4px 8px;
      }
      
      .chat-item:hover {
        background: linear-gradient(135deg, #ffebee 0%, #ffffff 100%);
      }
      
      .chat-item.active {
        background: linear-gradient(135deg, #ef5350 0%, #c62828 100%);
        color: white;
      }
      
      .chat-item-content {
        flex: 1;
        overflow: hidden;
      }
      
      .chat-title {
        font-weight: 600;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .chat-item-date {
        font-size: 0.8em;
        opacity: 0.7;
      }
      
      .chat-actions {
        display: flex;
        gap: 8px;
      }
      
      .chat-actions button {
        background: none;
        border: none;
        padding: 6px;
        cursor: pointer;
        opacity: 0.6;
        transition: opacity 0.2s, transform 0.2s;
        border-radius: 4px;
      }
      
      .chat-actions button:hover {
        opacity: 1;
        transform: scale(1.1);
      }

      /* Enhanced form styles */
      .enhanced-document-form-container {
        animation: slideInUp 0.4s ease-out;
      }

      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `
    document.head.appendChild(style)
  }
})

window.createNewChat = () => {
  fetch("/user/chats/new", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "New Chat" }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const chatMessages = document.getElementById("chat-messages")
        if (chatMessages) {
          chatMessages.innerHTML = ""
        }

        window.currentChatId = data.chat_id

        const currentChatTitle = document.getElementById("currentChatTitle")
        if (currentChatTitle) {
          currentChatTitle.textContent = data.title
          currentChatTitle.dataset.chatId = data.chat_id
        }

        if (chatMessages) {
          chatMessages.innerHTML = `
            <div class="ai-message">
              <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                <p>Hello! I'm BAAC (Barangay Amungan Assistant Chatbot). How can I help you today?</p>
                <p>Feel free to ask any questions about Barangay Amungan or request assistance with barangay services.</p>
              </div>
            </div>
          `
        }

        // Reload chat list
        fetch("/user/chats")
          .then((response) => response.json())
          .then((data) => {
            window.chats = data.chats || []
            const chatList = document.getElementById("chat-history-list")
            if (chatList && window.renderChatList) {
              window.renderChatList()
            }
          })
      } else {
        alert("Error: " + (data.error || "Failed to create new chat"))
      }
    })
    .catch((error) => {
      console.error("Error creating new chat:", error)
      alert("Error creating new chat. Please try again.")
    })
}

window.updateChatTitle = (chatId, newTitle) => {
  if (!newTitle || newTitle.trim() === "") return

  fetch(`/user/chats/${chatId}/rename`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: newTitle.trim() }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const currentChatTitle = document.getElementById("currentChatTitle")
        if (window.currentChatId === chatId && currentChatTitle) {
          currentChatTitle.textContent = newTitle.trim()
        }

        const chatItem = document.getElementById(`chat-${chatId}`)
        if (chatItem) {
          const titleElement = chatItem.querySelector(".chat-title")
          if (titleElement) {
            titleElement.textContent = newTitle.trim()
          }
        }

        if (window.chats) {
          const chatIndex = window.chats.findIndex((c) => c.id === chatId)
          if (chatIndex !== -1) {
            window.chats[chatIndex].title = newTitle.trim()
          }
        }

        showNotification("Chat renamed successfully", "success")
      } else {
        showNotification(data.error || "Failed to rename chat", "error")
      }
    })
    .catch((error) => {
      console.error("Error renaming chat:", error)
      showNotification("An error occurred while renaming the chat", "error")
    })
}

window.renderChatList = () => {
  const chatList = document.getElementById("chat-history-list")
  if (!chatList) return

  if (window.chats.length === 0) {
    chatList.innerHTML = `
      <div class="empty-chats">
        <p>No chat history found.</p>
        <p>Start a new conversation to create your first chat.</p>
      </div>
    `
    return
  }

  chatList.innerHTML = ""

  window.chats.forEach((chat) => {
    const chatItem = document.createElement("div")
    chatItem.className = "chat-item"
    chatItem.id = `chat-${chat.id}`
    chatItem.dataset.chatId = chat.id

    if (chat.id === window.currentChatId) {
      chatItem.classList.add("active")
    }

    const chatDate = new Date(chat.updated_at)
    const today = new Date()
    let dateText = ""

    if (chatDate.toDateString() === today.toDateString()) {
      dateText = chatDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else if (chatDate.getFullYear() === today.getFullYear()) {
      dateText = chatDate.toLocaleDateString([], { month: "short", day: "numeric" })
    } else {
      dateText = chatDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    }

    chatItem.innerHTML = `
      <div class="chat-item-content">
        <div class="chat-title">${chat.title}</div>
        <div class="chat-item-date">${dateText}</div>
      </div>
      <div class="chat-actions">
        <button class="rename-chat-btn" title="Rename Chat">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        </button>
        <button class="delete-chat-btn" title="Delete Chat">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `

    chatItem.addEventListener("click", (e) => {
      if (!e.target.closest(".chat-actions")) {
        window.loadChat(chat.id)
      }
    })

    const renameBtn = chatItem.querySelector(".rename-chat-btn")
    if (renameBtn) {
      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        window.renameChat(chat.id)
      })
    }

    const deleteBtn = chatItem.querySelector(".delete-chat-btn")
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        window.deleteChat(chat.id)
      })
    }

    chatList.appendChild(chatItem)
  })
}

window.loadChat = (chatId) => {
  window.currentChatId = chatId

  const chat = window.chats.find((c) => c.id === chatId)
  if (chat) {
    const currentChatTitle = document.getElementById("currentChatTitle")
    if (currentChatTitle) {
      currentChatTitle.textContent = chat.title
      currentChatTitle.dataset.chatId = chatId
    }
  }

  const chatItems = document.querySelectorAll(".chat-item")
  chatItems.forEach((item) => {
    item.classList.remove("active")
    if (item.dataset.chatId == chatId) {
      item.classList.add("active")
    }
  })

  const chatMessages = document.getElementById("chat-messages")
  if (chatMessages) {
    chatMessages.innerHTML = ""
  }

  fetch(`/user/chats/${chatId}/messages`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success && data.messages && data.messages.length > 0) {
        data.messages.forEach((message) => {
          window.addMessage(message.message, message.is_user)
        })
      } else {
        window.addMessage(`
          <div class="ai-response" style="text-align: justify; line-height: 1.6;">
            <p>Hello! I'm BAAC (Barangay Amungan Assistant Chatbot). How can I help you today?</p>
            <p>Feel free to ask any questions about Barangay Amungan or request assistance with barangay services.</p>
          </div>
        `)
      }

      const isMobile = window.innerWidth <= 768
      if (isMobile) {
        const chatSidebar = document.getElementById("chat-history-panel")
        if (chatSidebar) {
          chatSidebar.classList.remove("active")
          const overlay = document.querySelector(".sidebar-overlay")
          if (overlay) {
            overlay.classList.remove("active")
          }
        }
      }
    })
    .catch((error) => {
      console.error("Error loading chat messages:", error)
      window.addMessage("Error loading chat messages. Please try again.")
    })
}

window.addMessage = (content, isUser = false) => {
  const chatMessages = document.getElementById("chat-messages")
  if (!chatMessages) return

  const messageDiv = document.createElement("div")
  messageDiv.classList.add("message")
  messageDiv.classList.add(isUser ? "user-message" : "ai-message")

  if (isUser) {
    messageDiv.textContent = content
  } else {
    messageDiv.innerHTML = content
  }

  chatMessages.appendChild(messageDiv)

  const chatContainer = document.getElementById("chat-container")
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight
  }
}
