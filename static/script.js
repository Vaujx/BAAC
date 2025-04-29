document.addEventListener("DOMContentLoaded", () => {
  const chatMessages = document.getElementById("chat-messages")
  const promptInput = document.getElementById("prompt")
  const submitButton = document.getElementById("submit-btn")

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

  // Initial AI message
  addMessage("Hello! I'm BAAC (Barangay Amungan Assistant Chatbot). How can I help you today?")

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