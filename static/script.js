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

// Daily copy limits configuration
const copyLimits = {
  "barangay clearance": 1,
  "barangay indigency": 5,
  "barangay residency": 2,
}

const currentLimits = null
const selectedDocuments = new Set()
const bookmarksContainer = document.getElementById("bookmarks-container")

// Function to adjust color
function adjustColor(color, amount) {
  return (
    "#" +
    color
      .slice(1)
      .split("")
      .map((hex) => {
        const val = Number.parseInt(hex, 16)
        const newVal = Math.min(Math.max(0, val + amount), 255).toString(16)
        return newVal.length === 1 ? "0" + newVal : newVal
      })
      .join("")
  )
}

// Function to show notifications
function showNotification(message, type = "info") {
  const notificationContainer = document.getElementById("notification-container")
  if (!notificationContainer) {
    console.error("Notification container not found!")
    return
  }

  const notification = document.createElement("div")
  notification.className = `notification ${type}`
  notification.textContent = message

  notificationContainer.appendChild(notification)

  setTimeout(() => {
    notification.remove()
  }, 5000)
}

// Document Types Configuration
const documentTypes = [
  {
    id: "barangay-clearance",
    name: "barangay clearance",
    displayName: "Barangay Clearance",
    description: "Official clearance certificate from the barangay",
    icon: "🆔",
    color: "#ef5350",
  },
  {
    id: "barangay-residency",
    name: "barangay residency",
    displayName: "Barangay Residency Certificate",
    description: "Proof of residency in Barangay Amungan",
    icon: "🏠",
    color: "#1976d2",
  },
  {
    id: "barangay-indigency",
    name: "barangay indigency",
    displayName: "Barangay Indigency Certificate",
    description: "Certificate for individuals with low income",
    icon: "📄",
    color: "#7b1fa2",
  },
]

// Global state to store limits
let globalCopyLimits = {}

const adjustColorBrightness = (color, percent) => {
  const usePound = color[0] === "#"
  const col = usePound ? color.slice(1) : color
  const num = Number.parseInt(col, 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.max(0, (num >> 16) + amt)
    .toString(16)
    .padStart(2, "0")
  const G = Math.max(0, ((num >> 8) & 0x00ff) + amt)
    .toString(16)
    .padStart(2, "0")
  const B = Math.max(0, (num & 0x0000ff) + amt)
    .toString(16)
    .padStart(2, "0")
  return (usePound ? "#" : "") + R + G + B
}

async function loadLimitsOnInit() {
  try {
    const response = await fetch("/user/copy-limits")
    const data = await response.json()
    if (data.success) {
      globalCopyLimits = data.limits
      console.log("[v0] Limits loaded on init:", globalCopyLimits)
    }
  } catch (error) {
    console.error("Error loading initial limits:", error)
  }
}
async function initializeTodayDate() {
  try {
    const response = await fetch('/api/today-date')
    const data = await response.json()
    console.log('[v0] Today\'s date from server:', data.date)
    console.log('[v0] Full response:', data)
    return data.date
  } catch (error) {
    console.error('[v0] Error fetching date:', error)
  }
}
// <CHANGE> Add this function to monitor date changes and refresh limits daily
let lastKnownDate = null

async function monitorDateChange() {
  try {
    const response = await fetch('/api/today-date')
    const data = await response.json()
    const todayDate = data.date
    
    if (lastKnownDate === null) {
      lastKnownDate = todayDate
      console.log('[v0] Initial date set to:', lastKnownDate)
    } else if (lastKnownDate !== todayDate) {
      console.log('[v0] Date changed from', lastKnownDate, 'to', todayDate)
      lastKnownDate = todayDate
      // Refresh limits when date changes (midnight passed)
      await loadLimitsOnInit()
      console.log('[v0] Limits refreshed for new day:', todayDate)
    }
  } catch (error) {
    console.error('[v0] Error monitoring date:', error)
  }
}

// <CHANGE> Check date change every minute
setInterval(monitorDateChange, 60000)

// Initialize the chat interface
document.addEventListener("DOMContentLoaded", async () => {
  await loadLimitsOnInit()
  await initializeTodayDate()
  await monitorDateChange()
  //await initializeTodayDate() // TEST - Comment out after testing

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

          // Moved this block to be after addMessage
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

          // Changed this to requiresAuth to match updated response from backend
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

  function addFormSuggestionButton(documentType) {
    if (!isUserLoggedIn()) {
      addAuthRequiredMessage(documentType)
      return
    }

    // Check if this document has reached its limit
    const limitInfo = copyLimits[documentType]
    const isLimitReached = limitInfo && limitInfo.remaining === 0

    const suggestionDiv = document.createElement("div")
    suggestionDiv.className = "form-suggestion"

    if (isLimitReached) {
      // Show disabled state when limit is reached
      suggestionDiv.innerHTML = `
      <div style="background: linear-gradient(135deg, #ffebee 0%, #ffffff 100%); border: 2px solid #ef5350; border-radius: 12px; padding: 20px; margin: 15px 0; box-shadow: 0 6px 20px rgba(239, 83, 80, 0.15); opacity: 0.6;">
        <p style="margin: 0 0 12px 0; color: #c62828; font-weight: 600; font-size: 16px;"><strong>⏰ Daily Limit Reached</strong></p>
        <p style="margin: 0 0 20px 0; color: #d32f2f; line-height: 1.5;">${documentType.charAt(0).toUpperCase() + documentType.slice(1)} requests have reached the daily limit. Available tomorrow at 12:00 AM.</p>
      </div>
    `
    } else {
      // Show enabled button when limit not reached
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
        // Pass empty array to open form with NO pre-selected documents
        showDocumentForm([])
        suggestionDiv.remove()
        scrollToBottom()
      })
    }

    chatMessages.appendChild(suggestionDiv)
    scrollToBottom()
  }

  // Function to suggest all three document types with limit checking
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
            .map((docType) => {
              // Check limit for each document
              const limitInfo = copyLimits[docType.name]
              const isLimitReached = limitInfo && limitInfo.remaining === 0
              const buttonOpacity = isLimitReached ? "0.5" : "1"
              const cursorStyle = isLimitReached ? "not-allowed" : "pointer"
              const pointerEvents = isLimitReached ? "none" : "auto"

              return `
                <button 
                  class="document-btn" 
                  data-type="${docType.name}" 
                  data-limit-reached="${isLimitReached ? "true" : "false"}"
                  style="background: linear-gradient(135deg, ${docType.color} 0%, ${adjustColorBrightness(docType.color, -20)} 100%); color: white; border: none; padding: 14px 20px; border-radius: 8px; cursor: ${cursorStyle}; font-weight: 600; font-size: 15px; transition: transform 0.2s ease, box-shadow 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 10px; opacity: ${buttonOpacity}; pointer-events: ${pointerEvents};">
                  <span style="font-size: 18px;">${isLimitReached ? "⏰" : docType.icon}</span>
                  <div style="text-align: left; flex: 1;">
                    <div style="font-weight: 700;">${docType.displayName}${isLimitReached ? " (Limit Reached)" : ""}</div>
                    <div style="font-size: 12px; opacity: 0.9;">${isLimitReached ? "Daily limit reached. Available tomorrow." : docType.description}</div>
                  </div>
                </button>
              `
            })
            .join("")}
        </div>
        <p style="margin: 20px 0 0 0; font-size: 14px; color: #666; text-align: center; font-style: italic;">Click on any document to open the request form, or select multiple documents at once.</p>
      </div>
    `

      const buttons = suggestionDiv.querySelectorAll(".document-btn")
      buttons.forEach((button) => {
        // Only add click handler if limit not reached
        if (button.getAttribute("data-limit-reached") === "false") {
          button.addEventListener("click", () => {
            // Pass empty array to open form with NO pre-selected documents
            showDocumentForm([])
            suggestionDiv.remove()
            scrollToBottom()
          })
        }
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

 // Enhanced document form with multiple document selection - MOBILE RESPONSIVE
function showDocumentForm(preselectedTypes = []) {
  if (!isUserLoggedIn()) {
    addAuthRequiredMessage(preselectedTypes[0] || "documents")
    return
  }

  formOverlay.innerHTML = ""

  const isMobile = window.innerWidth < 768
  const isSmallPhone = window.innerWidth < 480

  const formContainer = document.createElement("div")
  formContainer.className = "enhanced-document-form-container"
  formContainer.style.cssText = `
    background: white;
    border-radius: ${isSmallPhone ? "12px" : "20px"};
    max-width: 1000px;
    width: ${isSmallPhone ? "100vw" : "95%"};
    max-height: ${isSmallPhone ? "100vh" : "90vh"};
    overflow: hidden;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
    position: relative;
    display: flex;
    border: 3px solid #ffcdd2;
    flex-direction: ${isMobile ? "column" : "row"};
  `

  // <CHANGE> Create document selector sidebar with mobile responsive styling
  const sidebarContainer = document.createElement("div")
  sidebarContainer.className = "document-selector-sidebar"
  sidebarContainer.style.cssText = `
    width: ${isMobile ? "100%" : "300px"};
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-right: ${isMobile ? "none" : "2px solid #dee2e6"};
    border-bottom: ${isMobile ? "2px solid #dee2e6" : "none"};
    padding: 0;
    overflow-y: auto;
    position: relative;
    max-height: ${isMobile ? "45vh" : "auto"};
    -webkit-overflow-scrolling: touch;
  `

  // Sidebar header
  const sidebarHeader = document.createElement("div")
  sidebarHeader.style.cssText = `
    background: linear-gradient(135deg, #ef5350 0%, #c62828 100%);
    color: white;
    padding: ${isSmallPhone ? "15px" : "20px"};
    text-align: center;
    position: sticky;
    top: 0;
    z-index: 10;
  `
  sidebarHeader.innerHTML = `
    <h3 style="margin: 0; font-size: ${isSmallPhone ? "16px" : "18px"}; font-weight: 700;">Select Documents</h3>
    <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">Choose one or more</p>
  `

  // Document bookmarks
  const bookmarksContainer = document.createElement("div")
  bookmarksContainer.className = "document-bookmarks"
  bookmarksContainer.style.cssText = `
    padding: ${isSmallPhone ? "10px 12px" : "20px 15px"};
  `

  // Use the global selectedDocuments set
  selectedDocuments.clear()
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
    const limitInfo = globalCopyLimits[docType.name]
    const isLimitReached = limitInfo && limitInfo.remaining === 0

    bookmark.style.cssText = `
      background: ${isSelected ? `linear-gradient(135deg, ${docType.color} 0%, ${adjustColorBrightness(docType.color, -20)} 100%)` : "white"};
      color: ${isSelected ? "white" : "#333"};
      border: 2px solid ${docType.color};
      border-radius: 15px;
      padding: ${isSmallPhone ? "12px" : "15px"};
      margin-bottom: 12px;
      cursor: ${isLimitReached ? "not-allowed" : "pointer"};
      transition: all 0.3s ease;
      position: relative;
      box-shadow: ${isSelected ? `0 6px 20px ${docType.color}40` : "0 2px 8px rgba(0,0,0,0.1)"};
      transform: ${isSelected ? "translateX(5px)" : "translateX(0)"};
      opacity: ${isLimitReached ? "0.5" : "1"};
      pointer-events: ${isLimitReached ? "none" : "auto"};
      font-size: ${isSmallPhone ? "14px" : "16px"};
    `

    let displayName = docType.displayName
    let description = docType.description

    if (isLimitReached) {
      displayName += " (Limit Reached)"
      description = "Daily limit reached. Available tomorrow."
    }

    bookmark.innerHTML = `
      <div style="display: flex; align-items: center; gap: ${isSmallPhone ? "8px" : "12px"}; flex-wrap: wrap;">
        <div style="font-size: ${isSmallPhone ? "20px" : "24px"}; opacity: ${isLimitReached ? "0.5" : "1"};">${docType.icon}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 700; font-size: ${isSmallPhone ? "14px" : "16px"}; margin-bottom: 4px; color: ${isLimitReached ? "#999" : "#333"};">${displayName}</div>
          <div style="font-size: 12px; opacity: ${isLimitReached ? "0.6" : "0.8"}; color: ${isLimitReached ? "#999" : "#666"};">${description}</div>
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
          opacity: ${isLimitReached ? "0.5" : "1"};
          flex-shrink: 0;
        ">
          ${isSelected ? '<span style="color: white; font-weight: bold; font-size: 16px;">✓</span>' : ""}
        </div>
      </div>
    `

    if (!isLimitReached) {
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
          bookmark.style.background = `linear-gradient(135deg, ${docType.color} 0%, ${adjustColorBrightness(docType.color, -20)} 100%)`
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
    }

    bookmarksContainer.appendChild(bookmark)
  })

  sidebarContainer.appendChild(sidebarHeader)
  sidebarContainer.appendChild(bookmarksContainer)

  // <CHANGE> Create main form area with mobile responsive flex layout
  const mainFormArea = document.createElement("div")
  mainFormArea.className = "main-form-area"
  mainFormArea.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  `

  // Form header
  const formHeader = document.createElement("div")
  formHeader.style.cssText = `
    background: linear-gradient(135deg, #ef5350 0%, #c62828 100%);
    color: white;
    padding: ${isSmallPhone ? "15px 15px 15px 50px" : "20px 30px"};
    position: relative;
    flex-shrink: 0;
  `
  formHeader.innerHTML = `
    <h2 style="margin: 0; font-size: ${isSmallPhone ? "18px" : "24px"}; font-weight: 700;">Document Request Form</h2>
    <p style="margin: 8px 0 0 0; opacity: 0.95; font-size: 14px;">Fill out your information</p>
  `

  // <CHANGE> Close button with mobile positioning
  const closeBtn = document.createElement("button")
  closeBtn.className = "form-close-btn"
  closeBtn.innerHTML = "×"
  closeBtn.style.cssText = `
    position: absolute;
    top: ${isSmallPhone ? "10px" : "15px"};
    right: ${isSmallPhone ? "10px" : "20px"};
    background: rgba(255,255,255,0.2);
    border: none;
    font-size: ${isSmallPhone ? "24px" : "28px"};
    cursor: pointer;
    color: white;
    width: ${isSmallPhone ? "35px" : "40px"};
    height: ${isSmallPhone ? "35px" : "40px"};
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    transition: all 0.2s ease;
    z-index: 20;
  `
  closeBtn.addEventListener("click", () => {
    formOverlay.style.display = "none"
    scrollToBottom()
  })

  formHeader.appendChild(closeBtn)

  // <CHANGE> Form content area with mobile touch scrolling
  const formContent = document.createElement("div")
  formContent.className = "form-content-area"
  formContent.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: ${isSmallPhone ? "20px" : "30px"};
    background: linear-gradient(135deg, #fafafa 0%, #ffffff 100%);
    -webkit-overflow-scrolling: touch;
  `

  // Common fields section
  const commonFieldsSection = document.createElement("div")
  commonFieldsSection.className = "common-fields-section"
  commonFieldsSection.innerHTML = `
    <div style="margin-bottom: 30px;">
      <h3 style="margin: 0 0 20px 0; color: #c62828; font-size: ${isSmallPhone ? "16px" : "20px"}; font-weight: 600; border-bottom: 2px solid #ffcdd2; padding-bottom: 10px;">
        Request Details
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
          style="width: 100%; padding: 12px; border: 2px solid #ffcdd2; border-radius: 8px; font-size: 16px; box-sizing: border-box;"
        >
      </div>
    </div>
  `

  // Dynamic forms container
  const dynamicFormsContainer = document.createElement("div")
  dynamicFormsContainer.className = "dynamic-forms-container"
  dynamicFormsContainer.id = "dynamicFormsContainer"

  // <CHANGE> Submit button with mobile responsive sizing
  const submitBtn = document.createElement("button")
  submitBtn.type = "submit"
  submitBtn.className = "enhanced-submit-btn"
  submitBtn.style.cssText = `
    width: 100%;
    padding: ${isSmallPhone ? "14px" : "18px"};
    background: linear-gradient(135deg, #ef5350 0%, #c62828 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: ${isSmallPhone ? "14px" : "18px"};
    font-weight: 700;
    cursor: pointer;
    margin-top: 30px;
    margin-bottom: ${isSmallPhone ? "20px" : "0"};
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
          <small style="color: #666; font-size: 13px; margin-top: 5px; display: block;"></small>
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

      // Load and display copy limits after form is updated
      displayCopyLimitUI()
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
          document_types: Array.from(selectedDocuments),
          date: dateValue,
          purpose: combinedPurpose,
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
          const errorData = await response.json()

          if (response.status === 429 && errorData.limit_info) {
            const limitInfo = errorData.limit_info
            const resetTime = new Date(limitInfo.reset_time).getTime()

            alert(
              `Daily Copy Limit Reached!\n\nDocument: ${limitInfo.document_type}\nUsed: ${limitInfo.used}/${limitInfo.limit}\n\nYou can request again tomorrow.`,
            )

            // Show timer
            showResetTimer(resetTime)

            formOverlay.style.display = "none"
            submitBtn.disabled = false
            updateSubmitButton()
            return
          }

          const errorText = errorData.error || (await response.text())
          throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`)
        }

        const result = await response.json()

        if (result.success) {
          formOverlay.style.display = "none"
          addMessage(result.response)

          // Reload limits after successful submission
          await loadLimitsOnInit()
          displayCopyLimitUI()

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

  // Fetch and display copy limits in the form
  async function displayCopyLimitUI() {
    try {
      const response = await fetch("/user/copy-limits")
      const data = await response.json()

      if (data.success) {
        const limits = data.limits
        globalCopyLimits = limits // Update global limits
        updateCopyLimitDisplay(limits)
      }
    } catch (error) {
      console.error("Error fetching copy limits:", error)
    }
  }

  // Enhanced updateCopyLimitDisplay to handle submit button visibility
  function updateCopyLimitDisplay(limits) {
    const copyInputs = document.querySelectorAll('input[id^="copies-"]')
    const submitBtn = document.querySelector(".enhanced-submit-btn")

    copyInputs.forEach((input) => {
      const docTypeId = input.id.replace("copies-", "")

      // Find matching document type
      const docTypeMap = [
        { id: "barangay-clearance", name: "barangay clearance" },
        { id: "barangay-residency", name: "barangay residency" },
        { id: "barangay-indigency", name: "barangay indigency" },
      ]

      const docType = docTypeMap.find((dt) => dt.id === docTypeId)
      if (!docType) return

      const limitInfo = limits[docType.name]
      if (!limitInfo) return

      const limitContainer = input.closest(".document-specific-form")
      if (!limitContainer) return

      // Remove existing limit display
      const existingLimitDisplay = limitContainer.querySelector(".copy-limit-alert")
      if (existingLimitDisplay) {
        existingLimitDisplay.remove()
      }

      // Create persistent limit alert that shows whether limit is reached or not
      const limitAlert = document.createElement("div")
      limitAlert.className = "copy-limit-alert"

      if (limitInfo.remaining === 0) {
        // Limit reached - disable input and show alert
        limitAlert.innerHTML = `
          <div style="
            background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
            border: 2px solid #e53935;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
          ">
            <span style="font-size: 24px;">⏰</span>
            <div style="flex: 1;">
              <div style="
                color: #c62828;
                font-weight: 700;
                font-size: 15px;
                margin-bottom: 4px;
              ">
                Daily limit reached for ${docType.name.toUpperCase()}
              </div>
              <div style="
                color: #d32f2f;
                font-size: 13px;
                font-weight: 500;
              ">
                ↻ Resets tomorrow at 12:00 AM
              </div>
            </div>
          </div>
        `

        // Disable the input
        input.disabled = true
        input.value = 0
        input.style.opacity = "0.5"
        input.style.cursor = "not-allowed"
        input.style.backgroundColor = "#ffebee"
      } else {
        // Limit not reached - show remaining count
        limitAlert.innerHTML = `
          <div style="
            background: linear-gradient(135deg, #f0f4ff 0%, #e8f5e9 100%);
            border: 2px solid #1976d2;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div>
              <div style="
                color: #1565c0;
                font-weight: 700;
                font-size: 15px;
                margin-bottom: 4px;
              ">
                Daily Copies Remaining
              </div>
              <div style="
                color: #2196f3;
                font-size: 13px;
                font-weight: 500;
              ">
                Progress: ${limitInfo.used} / ${limitInfo.limit} used
              </div>
            </div>
            <div style="
              background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
              color: white;
              padding: 8px 16px;
              border-radius: 6px;
              font-weight: 700;
              font-size: 16px;
              min-width: 60px;
              text-align: center;
            ">
              ${limitInfo.remaining} left
            </div>
          </div>
        `

        // Enable the input
        input.disabled = false
        input.max = limitInfo.remaining
        input.style.opacity = "1"
        input.style.cursor = "pointer"
        input.style.backgroundColor = "#ffffff"
      }

      // Insert at the top of the form section
      limitContainer.insertBefore(limitAlert, limitContainer.firstChild)
    })

    // Check if ANY selected document can still be requested
    if (submitBtn) {
      const selectedForms = document.querySelectorAll(".document-specific-form")
      let hasAvailableDocument = false

      selectedForms.forEach((form) => {
        const copyInput = form.querySelector('input[id^="copies-"]')
        if (copyInput && !copyInput.disabled) {
          hasAvailableDocument = true
        }
      })

      // Hide submit button if NO documents are available to request
      if (selectedForms.length > 0 && !hasAvailableDocument) {
        submitBtn.style.display = "none"

        // Add message explaining why button is hidden
        const noAvailableMsg = document.querySelector(".no-available-msg")
        if (!noAvailableMsg) {
          const msg = document.createElement("div")
          msg.className = "no-available-msg"
          msg.style.cssText = `
            background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
            border: 2px solid #e53935;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            color: #c62828;
            font-weight: 600;
            margin-top: 20px;
          `
          msg.innerHTML = `
            <span style="font-size: 20px;">⏰</span><br>
            All selected documents have reached their daily limits.<br>
            <small style="font-size: 13px; opacity: 0.8;">They will reset tomorrow at 12:00 AM</small>
          `
          submitBtn.parentNode.appendChild(msg)
        }
      } else {
        submitBtn.style.display = "block"

        // Remove no-available message if it exists
        const noAvailableMsg = document.querySelector(".no-available-msg")
        if (noAvailableMsg) {
          noAvailableMsg.remove()
        }
      }
    }
  }

  function showResetTimer(resetTimestamp) {
    const timerContainer = document.createElement("div")
    timerContainer.className = "reset-timer-display"
    timerContainer.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      background: linear-gradient(135deg, #fff9e6 0%, #fffde7 100%);
      border: 2px solid #fbc02d;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 4px 12px rgba(251, 192, 45, 0.3);
      z-index: 999;
      font-weight: 600;
      color: #f57f17;
      text-align: center;
      max-width: 250px;
    `

    function updateTimer() {
      const now = Date.now()
      const difference = resetTimestamp - now

      if (difference <= 0) {
        timerContainer.remove()
        return
      }

      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((difference / (1000 * 60)) % 60)
      const seconds = Math.floor((difference / 1000) % 60)

      timerContainer.innerHTML = `
        <div style="font-size: 14px; margin-bottom: 8px;">⏳ Next Reset In:</div>
        <div style="font-size: 20px; font-weight: 700; font-family: 'Courier New', monospace;">
          ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}
        </div>
        <div style="font-size: 11px; margin-top: 8px; opacity: 0.8;">Resets at 12:00 AM</div>
      `
    }

    updateTimer()
    document.body.appendChild(timerContainer)

    const timerInterval = setInterval(() => {
      updateTimer()
      if (Date.now() > resetTimestamp) {
        clearInterval(timerInterval)
        timerContainer.remove()
      }
    }, 1000)
  }

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
      body: JSON.stringify({ title: newTitle.trim() }), // Corrected: JSON.JSON.stringify to JSON.stringify
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

function viewDocumentPreview(docId) {
  // Open preview in new tab
  window.open(`/document/preview/${docId}`, "_blank", "width=900,height=1000,menubar=no,toolbar=no")
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
