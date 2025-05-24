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
  const formOverlay = document.createElement("div")

  // Chat history elements - FIXED: Use the correct ID from your HTML
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
    // Check multiple indicators of login status
    return (
      document.body.classList.contains("user-logged-in") ||
      document.querySelector(".user-info") !== null ||
      document.querySelector('[data-user-logged-in="true"]') !== null ||
      document.getElementById("user-dropdown") !== null
    )
  }

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

          // If this is the first message in a new chat, update the chat title
          if (currentChatId && chats.length > 0) {
            const currentChat = chats.find((chat) => chat.id === currentChatId)
            if (currentChat && currentChat.title === "New Chat") {
              // Use the first few words of the user's prompt as the chat title
              const newTitle = prompt.length > 30 ? prompt.substring(0, 30) + "..." : prompt
              updateChatTitle(currentChatId, newTitle)
            }
          }

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

          // If authentication is required for document request
          if (data.requiresAuth && data.documentType) {
            addAuthRequiredMessage(data.documentType)
            // Force scroll after adding auth message
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

        // Refresh the chat list to update the last updated time
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
      <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 10px 0;">
        <p style="margin: 0 0 10px 0; color: #856404;"><strong>Authentication Required</strong></p>
        <p style="margin: 0 0 15px 0; color: #856404;">You need to be logged in to request a ${documentType.charAt(0).toUpperCase() + documentType.slice(1)}.</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button onclick="window.location.href='/login'" style="background-color: #4CAF50; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold;">Login</button>
          <button onclick="window.location.href='/register'" style="background-color: #2196F3; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold;">Sign Up</button>
        </div>
      </div>
    `

    chatMessages.appendChild(authMessage)
    scrollToBottom()
  }

  // Function to suggest a specific document form
  function addFormSuggestionButton(documentType) {
    // Check if user is logged in before showing form suggestion
    if (!isUserLoggedIn()) {
      addAuthRequiredMessage(documentType)
      return
    }

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

    // Check if user is logged in
    const userLoggedIn = isUserLoggedIn()

    if (userLoggedIn) {
      // User is logged in - show document request buttons
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
    } else {
      // User is not logged in - show login/signup buttons
      suggestionDiv.innerHTML = `
        <p><strong>Available Document Requests:</strong> I can help you request Barangay Clearance, Barangay Indigency, and Barangay Residency documents.</p>
        <p style="color: #e74c3c; font-weight: bold;">However, you need to be logged in to submit document requests.</p>
        <div class="auth-buttons-container" style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
          <button onclick="window.location.href='/login'" class="auth-button login-button" style="background-color: #4CAF50; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; transition: opacity 0.3s;">Login</button>
          <button onclick="window.location.href='/register'" class="auth-button register-button" style="background-color: #2196F3; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; transition: opacity 0.3s;">Sign Up</button>
        </div>
        <p style="margin-top: 10px; font-size: 0.9em; color: #666; text-align: center;">Creating an account allows you to track the status of your document requests and access your request history.</p>
      `
    }

    chatMessages.appendChild(suggestionDiv)
    // Force scroll after adding suggestions
    scrollToBottom()
  }

 function showDocumentForm(documentType) {
    // Check if user is logged in before showing the form
    if (!isUserLoggedIn()) {
        addAuthRequiredMessage(documentType);
        return;
    }

    // Clear any existing form
    formOverlay.innerHTML = "";

    // Create form container
    const formContainer = document.createElement("div");
    formContainer.className = "document-form-container";

    // Create form title
    const formTitle = document.createElement("h2");
    formTitle.textContent = "Document Request Form";

    // Create document type selector section
    const selectorSection = document.createElement("div");
    selectorSection.className = "document-selector-section";
    selectorSection.innerHTML = `
        <h3>Select Document Types</h3>
        <div class="document-type-options">
            <label class="document-option ${documentType === 'barangay clearance' ? 'selected' : ''}" data-type="barangay clearance">
                <input type="checkbox" ${documentType === 'barangay clearance' ? 'checked' : ''}>
                <span class="checkmark"></span>
                Barangay Clearance
            </label>
            <label class="document-option ${documentType === 'barangay residency' ? 'selected' : ''}" data-type="barangay residency">
                <input type="checkbox" ${documentType === 'barangay residency' ? 'checked' : ''}>
                <span class="checkmark"></span>
                Barangay Residency
            </label>
            <label class="document-option ${documentType === 'barangay indigency' ? 'selected' : ''}" data-type="barangay indigency">
                <input type="checkbox" ${documentType === 'barangay indigency' ? 'checked' : ''}>
                <span class="checkmark"></span>
                Barangay Indigency
            </label>
        </div>
    `;

    // Create main form
    const form = document.createElement("form");
    form.id = "documentForm";
    form.className = "document-form";

    // Add common fields section
    const commonFieldsSection = document.createElement("div");
    commonFieldsSection.className = "common-fields-section";
    commonFieldsSection.innerHTML = `
        <h3>Personal Information</h3>
        <div class="form-group">
            <label for="date">Date:</label>
            <input type="date" id="date" name="date" required value="${new Date().toISOString().split("T")[0]}">
        </div>
        
        <div class="form-group">
            <label for="name">Full Name:</label>
            <input type="text" id="name" name="name" required placeholder="EX: John james M. Dayap">
        </div>
        
        <div class="form-group">
            <label for="purok">Purok:</label>
            <input type="text" id="purok" name="purok" required placeholder="Enter your purok number">
        </div>
    `;

    // Create dynamic forms container
    const dynamicFormsContainer = document.createElement("div");
    dynamicFormsContainer.className = "dynamic-forms-container";
    dynamicFormsContainer.id = "dynamicFormsContainer";

    // Create submit button
    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "form-submit-btn";
    submitBtn.textContent = "Submit All Requests";
    submitBtn.disabled = true; // Initially disabled

    // Create close button
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "form-close-btn";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => {
        formOverlay.style.display = "none";
        scrollToBottom();
    });

    // Assemble form
    form.appendChild(commonFieldsSection);
    form.appendChild(dynamicFormsContainer);
    form.appendChild(submitBtn);

    formContainer.appendChild(closeBtn);
    formContainer.appendChild(formTitle);
    formContainer.appendChild(selectorSection);
    formContainer.appendChild(form);
    formOverlay.appendChild(formContainer);

    // Function to create document-specific form
    function createDocumentSpecificForm(docType) {
        const formSection = document.createElement("div");
        formSection.className = "document-specific-form";
        formSection.id = `form-${docType.replace(/\s+/g, '-')}`;
        
        let specificFields = `
            <h4>${docType.charAt(0).toUpperCase() + docType.slice(1)}</h4>
            <div class="form-group">
                <label for="purpose-${docType.replace(/\s+/g, '-')}">Purpose/Remarks:</label>
                <textarea id="purpose-${docType.replace(/\s+/g, '-')}" name="purpose-${docType.replace(/\s+/g, '-')}" required placeholder="Enter the purpose of this ${docType} request"></textarea>
            </div>
        `;

        // Add copies field for barangay indigency
        if (docType === "barangay indigency") {
            specificFields += `
                <div class="form-group">
                    <label for="copies-${docType.replace(/\s+/g, '-')}">No. of Copies:</label>
                    <input type="number" id="copies-${docType.replace(/\s+/g, '-')}" name="copies-${docType.replace(/\s+/g, '-')}" required min="1" value="1">
                </div>
            `;
        }

        formSection.innerHTML = specificFields;
        return formSection;
    }

    // Function to update dynamic forms based on selected document types
    function updateDynamicForms() {
        const selectedTypes = [];
        const checkboxes = selectorSection.querySelectorAll('input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                const docType = checkbox.parentElement.getAttribute('data-type');
                selectedTypes.push(docType);
            }
        });

        // Clear existing forms
        dynamicFormsContainer.innerHTML = "";

        // Create forms for selected types
        selectedTypes.forEach(docType => {
            const formSection = createDocumentSpecificForm(docType);
            dynamicFormsContainer.appendChild(formSection);
        });

        // Enable/disable submit button
        submitBtn.disabled = selectedTypes.length === 0;
        
        // Update submit button text
        if (selectedTypes.length === 0) {
            submitBtn.textContent = "Select at least one document type";
        } else if (selectedTypes.length === 1) {
            submitBtn.textContent = "Submit Request";
        } else {
            submitBtn.textContent = `Submit ${selectedTypes.length} Requests`;
        }
    }

    // Add event listeners to checkboxes
    const checkboxes = selectorSection.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const label = e.target.parentElement;
            if (e.target.checked) {
                label.classList.add('selected');
            } else {
                label.classList.remove('selected');
            }
            updateDynamicForms();
        });
    });

    // Initialize with the requested document type
    updateDynamicForms();

    // Show form
    formOverlay.style.display = "flex";

    // Handle form submission
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Collect common data
        const commonData = {
            date: document.getElementById("date").value,
            name: document.getElementById("name").value,
            purok: document.getElementById("purok").value,
        };

        // Collect data for each selected document type
        const selectedTypes = [];
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                const docType = checkbox.parentElement.getAttribute('data-type');
                selectedTypes.push(docType);
            }
        });

        // Prepare requests array
        const requests = [];
        selectedTypes.forEach(docType => {
            const docTypeId = docType.replace(/\s+/g, '-');
            const purposeElement = document.getElementById(`purpose-${docTypeId}`);
            const copiesElement = document.getElementById(`copies-${docTypeId}`);

            const requestData = {
                documentType: docType,
                ...commonData,
                purpose: purposeElement.value,
            };

            // Add copies if it exists (for barangay indigency)
            if (copiesElement) {
                requestData.copies = copiesElement.value;
            }

            requests.push(requestData);
        });

        // Disable submit button and show loading
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        try {
            // Submit all requests
            const results = await Promise.all(
                requests.map(requestData => 
                    fetch("/submit_document", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(requestData),
                    }).then(response => response.json())
                )
            );

            // Check if all requests were successful
            const successfulRequests = results.filter(result => result.success);
            const failedRequests = results.filter(result => !result.success);

            if (successfulRequests.length > 0) {
                // Hide form
                formOverlay.style.display = "none";

                // Create success message
                let responseText = `
                    <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                        <p><strong>Document Request${successfulRequests.length > 1 ? 's' : ''} Submitted Successfully!</strong></p>
                `;

                if (successfulRequests.length === 1) {
                    const result = successfulRequests[0];
                    responseText += `
                        <p>Your request for a <strong>${requests[0].documentType.title()}</strong> has been submitted and is now being processed.</p>
                        <p><strong>Reference Number:</strong> ${result.reference_number}</p>
                    `;
                } else {
                    responseText += `<p>Your ${successfulRequests.length} document requests have been submitted and are now being processed.</p>`;
                    responseText += `<p><strong>Reference Numbers:</strong></p><ul>`;
                    
                    successfulRequests.forEach((result, index) => {
                        const docType = requests.find(req => req.documentType === Object.keys(result)[0] || requests[index].documentType);
                        responseText += `<li>${requests[index].documentType.title()}: ${result.reference_number}</li>`;
                    });
                    responseText += `</ul>`;
                }

                responseText += `
                        <p>Please save ${successfulRequests.length > 1 ? 'these reference numbers' : 'this reference number'} for tracking your request status.</p>
                        <p>You can check the status of your ${successfulRequests.length > 1 ? 'requests' : 'request'} by asking me about ${successfulRequests.length > 1 ? 'the reference numbers' : 'the reference number'}.</p>
                        <p>Processing time is typically 3-5 business days. You will be notified when your ${successfulRequests.length > 1 ? 'documents are' : 'document is'} ready for pickup.</p>
                `;

                if (failedRequests.length > 0) {
                    responseText += `
                        <p style="color: #e53935;"><strong>Note:</strong> ${failedRequests.length} request${failedRequests.length > 1 ? 's' : ''} failed to submit. Please try again for the failed ${failedRequests.length > 1 ? 'requests' : 'request'}.</p>
                    `;
                }

                responseText += `</div>`;

                // Show success message
                addMessage(responseText);
                scrollToBottom();
            } else {
                // All requests failed
                alert("Error: All document requests failed to submit. Please try again.");
            }

        } catch (error) {
            alert("Error: Unable to submit document requests");
            console.error("Error:", error);
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            updateDynamicForms(); // This will reset the button text
        }
    })
  }
  // Chat History Functions
  function loadChats() {
    if (!chatList) {
      console.error("Chat list element not found")
      return
    }

    console.log("Loading chats...")

    fetch("/user/chats")
      .then((response) => response.json())
      .then((data) => {
        console.log("Chats loaded:", data)
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
    if (!chatList) {
      console.error("Chat list element not found")
      return
    }

    console.log("Rendering chat list with", chats.length, "chats")

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

      // Format the date
      const chatDate = new Date(chat.updated_at)
      const today = new Date()
      let dateText = ""

      if (chatDate.toDateString() === today.toDateString()) {
        // Today - show time
        dateText = chatDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      } else if (chatDate.getFullYear() === today.getFullYear()) {
        // This year - show month and day
        dateText = chatDate.toLocaleDateString([], { month: "short", day: "numeric" })
      } else {
        // Different year - show date with year
        dateText = chatDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
      }

      // FIXED: Simplified structure to make clicking more reliable
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

      // FIXED: Add click event to the entire chat item
      chatItem.addEventListener("click", (e) => {
        // Only load chat if not clicking on action buttons
        if (!e.target.closest(".chat-actions")) {
          console.log("Chat item clicked, loading chat ID:", chat.id)
          loadChat(chat.id)
        }
      })

      // FIXED: Add specific click handlers for the buttons
      const renameBtn = chatItem.querySelector(".rename-chat-btn")
      if (renameBtn) {
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation() // Prevent triggering the chat item click
          console.log("Rename button clicked for chat ID:", chat.id)
          window.renameChat(chat.id)
        })
      }

      const deleteBtn = chatItem.querySelector(".delete-chat-btn")
      if (deleteBtn) {
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation() // Prevent triggering the chat item click
          console.log("Delete button clicked for chat ID:", chat.id)
          window.deleteChat(chat.id)
        })
      }

      chatList.appendChild(chatItem)
    })
  }

  function createNewChat() {
    console.log("Creating new chat...")

    fetch("/user/chats/new", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "New Chat" }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("New chat created:", data)

        if (data.success) {
          // Clear the chat messages
          chatMessages.innerHTML = ""

          // Set the current chat ID
          currentChatId = data.chat_id

          // Update the chat title
          if (currentChatTitle) {
            currentChatTitle.textContent = data.title
            currentChatTitle.dataset.chatId = data.chat_id
          }

          // Add initial AI message
          addMessage(`
            <div class="ai-response" style="text-align: justify; line-height: 1.6;">
              <p>Hello! I'm BAAC (Barangay Amungan Assistant Chatbot). How can I help you today?</p>
              <p>Feel free to ask me any questions about Barangay Amungan or request assistance with barangay services.</p>
            </div>
          `)

          // Refresh the chat list
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
    console.log("Loading chat ID:", chatId)

    // Set the current chat ID
    currentChatId = chatId

    // Find the chat in the list
    const chat = chats.find((c) => c.id === chatId)
    if (chat) {
      if (currentChatTitle) {
        currentChatTitle.textContent = chat.title
        // Store the chat ID in the title element for reference
        currentChatTitle.dataset.chatId = chatId
      }
    }

    // Update the active chat in the list
    const chatItems = document.querySelectorAll(".chat-item")
    chatItems.forEach((item) => {
      item.classList.remove("active")
      if (item.dataset.chatId == chatId) {
        item.classList.add("active")
      }
    })

    // Clear the chat messages
    chatMessages.innerHTML = ""

    // Load the chat messages
    fetch(`/user/chats/${chatId}/messages`)
      .then((response) => response.json())
      .then((data) => {
        console.log("Chat messages loaded:", data)

        if (data.success && data.messages && data.messages.length > 0) {
          data.messages.forEach((message) => {
            addMessage(message.message, message.is_user)
          })
        } else {
          // If no messages, add initial AI message
          addMessage(`
            <div class="ai-response" style="text-align: justify; line-height: 1.6;">
              <p>Hello! I'm BAAC (Barangay Amungan Assistant Chatbot). How can I help you today?</p>
              <p>Feel free to ask me any questions about Barangay Amungan or request assistance with barangay services.</p>
            </div>
          `)
        }

        // Close the sidebar on mobile after selecting a chat
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
    if (!newTitle || newTitle.trim() === "") {
      return
    }

    console.log("Updating chat title:", chatId, "to:", newTitle)

    fetch(`/user/chats/${chatId}/rename`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: newTitle.trim() }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Update chat title response:", data)

        if (data.success) {
          // Update the current chat title if this is the active chat
          if (currentChatId === chatId && currentChatTitle) {
            currentChatTitle.textContent = newTitle.trim()
          }

          // Update the chat in the list
          const chatItem = document.getElementById(`chat-${chatId}`)
          if (chatItem) {
            const titleElement = chatItem.querySelector(".chat-title")
            if (titleElement) {
              titleElement.textContent = newTitle.trim()
            }
          }

          // Update the chat in the chats array
          const chatIndex = chats.findIndex((c) => c.id === chatId)
          if (chatIndex !== -1) {
            chats[chatIndex].title = newTitle.trim()
          }

          // Show success notification
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

        // Create or remove overlay for mobile
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

  // Add event listener for Enter key in rename modal
  if (chatTitleInput) {
    chatTitleInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        saveChatTitleBtn.click()
      }
    })
  }

  // Window resize event to update isMobile
  window.addEventListener("resize", () => {
    isMobile = window.innerWidth <= 768
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

  // Load chat history if user is logged in
  if (chatList) {
    console.log("Chat list found, loading chats...")
    loadChats()

    // Create a new chat if none exists
    if (!currentChatId) {
      createNewChat()
    }
  } else {
    console.warn("Chat list element not found")
  }
})

// Notification function in global scope
function showNotification(message, type = "info") {
  const notification = document.createElement("div")
  notification.className = `notification ${type}`
  notification.textContent = message

  document.body.appendChild(notification)

  // Show the notification
  setTimeout(() => {
    notification.classList.add("show")
  }, 10)

  // Hide and remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove("show")
    setTimeout(() => {
      notification.remove()
    }, 300)
  }, 3000)
}

// Add notification styles if they don't exist
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("notification-styles")) {
    const style = document.createElement("style")
    style.id = "notification-styles"
    style.textContent = `
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        border-radius: 4px;
        color: white;
        opacity: 0;
        transform: translateY(-20px);
        transition: opacity 0.3s, transform 0.3s;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      }
      
      .notification.show {
        opacity: 1;
        transform: translateY(0);
      }
      
      .notification.success {
        background-color: #4CAF50;
      }
      
      .notification.error {
        background-color: #F44336;
      }
      
      .notification.info {
        background-color: #2196F3;
      }
      
      /* FIXED: Added styles for chat items to make them more clickable */
      .chat-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        border-bottom: 1px solid rgba(0,0,0,0.1);
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .chat-item:hover {
        background-color: rgba(0,0,0,0.05);
      }
      
      .chat-item.active {
        background-color: rgba(0,0,0,0.1);
      }
      
      .chat-item-content {
        flex: 1;
        overflow: hidden;
      }
      
      .chat-title {
        font-weight: 500;
        margin-bottom: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .chat-item-date {
        font-size: 0.8em;
        color: rgba(0,0,0,0.6);
      }
      
      .chat-actions {
        display: flex;
        gap: 5px;
      }
      
      .chat-actions button {
        background: none;
        border: none;
        padding: 5px;
        cursor: pointer;
        opacity: 0.6;
        transition: opacity 0.2s;
      }
      
      .chat-actions button:hover {
        opacity: 1;
      }
      
      /* Auth required message styles */
      .auth-required-message {
        margin: 10px 0;
        width: 100%;
      }
      
      .auth-buttons-container {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-top: 15px;
      }
      
      .auth-button {
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        transition: opacity 0.3s;
      }
      
      .auth-button:hover {
        opacity: 0.9;
      }
      
      .login-button {
        background-color: #4CAF50;
        color: white;
      }
      
      .register-button {
        background-color: #2196F3;
        color: white;
      }
    `
    document.head.appendChild(style)
  }
})

// FIXED: Add global loadChat function for direct access from HTML
window.loadChat = (chatId) => {
  // Find the chat item and simulate a click
  const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`)
  if (chatItem) {
    chatItem.click()
  }
}

// FIXED: Add global loadChatHistories function for direct access from HTML
window.loadChatHistories = () => {
  const chatList = document.getElementById("chat-history-list")
  if (chatList) {
    // Clear the list
    chatList.innerHTML = '<div class="loading-chats">Loading chats...</div>'

    // Fetch chats
    fetch("/user/chats")
      .then((response) => response.json())
      .then((data) => {
        if (!data.chats || data.chats.length === 0) {
          chatList.innerHTML = `
            <div class="empty-chats">
              <p>No chat history found.</p>
              <p>Start a new conversation to create your first chat.</p>
            </div>
          `
          return
        }

        chatList.innerHTML = ""

        // Get current chat ID if available
        const currentChatTitle = document.getElementById("currentChatTitle")
        const currentChatId = currentChatTitle ? currentChatTitle.dataset.chatId : null

        data.chats.forEach((chat) => {
          const chatItem = document.createElement("div")
          chatItem.className = "chat-item"
          chatItem.id = `chat-${chat.id}`
          chatItem.dataset.chatId = chat.id

          if (chat.id == currentChatId) {
            chatItem.classList.add("active")
          }

          // Format the date
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
              <button class="rename-chat-btn" title="Rename Chat" onclick="event.stopPropagation(); window.renameChat(${chat.id})">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
              <button class="delete-chat-btn" title="Delete Chat" onclick="event.stopPropagation(); window.deleteChat(${chat.id})">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          `

          // Add click event to load chat
          chatItem.addEventListener("click", (e) => {
            if (!e.target.closest(".chat-actions")) {
              console.log("Chat item clicked, loading chat ID:", chat.id)
              window.loadChat(chat.id)
            }
          })

          chatList.appendChild(chatItem)
        })
      })
      .catch((error) => {
        console.error("Error loading chat histories:", error)
        chatList.innerHTML = '<div class="empty-chats">Error loading chats. Please try again.</div>'
      })
  }
}

// Global function to check if user is logged in
window.isUserLoggedIn = () =>
  document.body.classList.contains("user-logged-in") ||
  document.querySelector(".user-info") !== null ||
  document.querySelector('[data-user-logged-in="true"]') !== null ||
  document.getElementById("user-dropdown") !== null

// Fixed renameChat function for global scope
window.renameChat = (chatId) => {
  console.log("Rename chat function called for chat ID:", chatId)

  // Get the current title
  let currentTitle = ""
  const chatItem = document.getElementById(`chat-${chatId}`)
  if (chatItem) {
    const titleElement = chatItem.querySelector(".chat-title")
    if (titleElement) {
      currentTitle = titleElement.textContent
    }
  }

  // Show the rename modal
  if (document.getElementById("renameChatModal")) {
    document.getElementById("chatTitle").value = currentTitle
    document.getElementById("renameChatModal").dataset.chatId = chatId
    document.getElementById("renameChatModal").style.display = "block"
    document.getElementById("chatTitle").focus()
  } else {
    // Fallback to prompt if modal not available
    const newTitle = prompt("Enter a new title for this chat:", currentTitle)
    if (newTitle && newTitle.trim() !== "") {
      window.updateChatTitle(chatId, newTitle)
    }
  }
}

// Fixed deleteChat function for global scope
window.deleteChat = (chatId) => {
  console.log("Delete chat function called for chat ID:", chatId)

  // Show the delete confirmation modal
  if (document.getElementById("deleteChatModal")) {
    document.getElementById("deleteChatModal").dataset.chatId = chatId
    document.getElementById("deleteChatModal").style.display = "block"
  } else {
    // Fallback to confirm if modal not available
    if (confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
      window.performDeleteChat(chatId)
    }
  }
}

// Declare the performDeleteChat function globally
window.performDeleteChat = (chatId) => {
  console.log("Performing delete for chat ID:", chatId)

  fetch(`/user/chats/${chatId}/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Delete chat response:", data)

      if (data.success) {
        // Remove the chat from the list
        const chatItem = document.getElementById(`chat-${chatId}`)
        if (chatItem) {
          chatItem.remove()
        }

        // Remove the chat from the chats array
        chats = chats.filter((c) => c.id !== chatId)

        // If this was the active chat, clear the chat area and create a new chat
        if (currentChatId === chatId) {
          document.getElementById("chat-messages").innerHTML = ""
          currentChatId = null
          if (document.getElementById("currentChatTitle")) {
            document.getElementById("currentChatTitle").textContent = "New Chat"
            document.getElementById("currentChatTitle").dataset.chatId = ""
          }

          // Create a new chat
          window.createNewChat()
        }

        // Show success notification
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
