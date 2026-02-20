/**
 * ================================================================================
 * PRODUCT MANUAL ASSISTANT - MAIN APPLICATION SCRIPT
 * ================================================================================
 *
 * AI-powered product manual navigation and knowledge extraction.
 *
 * ARCHITECTURE:
 * 1. PDF Upload → PDF.js extracts text from each page
 * 2. ScaleDown API compresses text (20% reduction, keeps specs/warnings)
 * 3. Gemini API categorizes content into JSON (safety, parts, warranty, etc.)
 * 4. Knowledge displayed in searchable cards with page references
 * 5. Chat uses RAG (Retrieval-Augmented Generation) for Q&A
 *
 * SECTIONS:
 * - State Management (global state object)
 * - DOM Elements (cached element references)
 * - Event Handlers (user interactions)
 * - PDF Processing (extraction, thumbnails)
 * - Knowledge Extraction (ScaleDown → Gemini pipeline)
 * - Knowledge Display (cards, modals, formatting)
 * - Chat System (RAG, message handling)
 * - Annotation Tools (canvas drawing)
 * - Metrics & Analytics (usage tracking)
 * - API Integration (ScaleDown, Gemini)
 *
 * DEPENDENCIES:
 * - PDF.js (Mozilla) - PDF rendering
 * - Marked.js - Markdown rendering
 * - Font Awesome - Icons
 *
 * @author SUDHARSAN G S
 * ================================================================================
 */

// ============================================================================
// UTILITY FUNCTIONS (Global Scope)
// ============================================================================

/**
 * Toggle password field visibility
 * @param {string} inputId - ID of the password input element
 * @param {HTMLElement} button - The toggle button element
 */
window.togglePassword = function (inputId, button) {
  const input = document.getElementById(inputId);
  const icon = button.querySelector("i");
  if (input.type === "password") {
    input.type = "text";
    icon.className = "fa-solid fa-eye-slash";
  } else {
    input.type = "password";
    icon.className = "fa-solid fa-eye";
  }
};

// ============================================================================
// MAIN APPLICATION
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  // Global application state - persisted data loaded from localStorage
  const state = {
    scaledownKey: localStorage.getItem("mn_scaledown_key") || "",
    scaledownModel: localStorage.getItem("mn_scaledown_model") || "gpt-4o",
    geminiKey: localStorage.getItem("mn_gemini_key") || "",
    geminiModel: localStorage.getItem("mn_gemini_model") || "gemini-2.0-flash",
    pdfPages: [],
    knowledgeBuckets: {},
    manualLibrary: JSON.parse(
      localStorage.getItem("mn_manual_library") || "[]",
    ),
    currentManualId: null,
    isProcessing: false,
    chatImageData: null, // For storing base64 image data for chat
    theme:
      localStorage.getItem("mn_theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"),
    annotations: JSON.parse(localStorage.getItem("mn_annotations") || "{}"),
    currentTool: "select",
    annotationColor: "#ff4d4f",
    metrics: JSON.parse(
      localStorage.getItem("mn_metrics") ||
      JSON.stringify({
        totalQueries: 0,
        resolvedQueries: 0,
        ticketsPrevented: 0,
        categoryStats: {
          safety: 0,
          parts: 0,
          warranty: 0,
          procedures: 0,
          errors: 0,
          video: 0,
        },
        ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        activityLog: [],
        surveys: [],
      }),
    ),
    surveyData: { found: null, rating: 0, support: null, comments: "" },
  };

  // ==========================================================================
  // DOM ELEMENT REFERENCES
  // ==========================================================================
  // Cached DOM element references for performance
  const configBtn = document.getElementById("config-btn");
  const libraryBtn = document.getElementById("library-btn");
  const dropZone = document.getElementById("drop-zone");
  const pdfUpload = document.getElementById("pdf-upload");
  const saveKeysBtn = document.getElementById("save-keys");
  const chatMessages = document.getElementById("chat-messages");
  const userQuery = document.getElementById("user-query");
  const sendBtn = document.getElementById("send-btn");
  const extractionStatus = document.getElementById("extraction-status");
  const galleryGrid = document.getElementById("visual-gallery");
  const themeToggle = document.getElementById("theme-toggle");
  const modelSelect = document.getElementById("gemini-model");
  const pageSearch = document.getElementById("page-search");
  const knowledgeList = document.getElementById("knowledge-list");
  const knowledgeGraph = document.getElementById("knowledge-graph");

  // Category definitions
  const CATEGORIES = {
    safety: {
      label: "Safety",
      icon: "fa-solid fa-triangle-exclamation",
      color: "#ff4d4f",
      sdPrompt:
        "Extract safety warnings, cautions, hazards, and operating restrictions. Remove pages without explicit safety info.",
    },
    parts: {
      label: "Parts & Specs",
      icon: "fa-solid fa-gear",
      color: "#1890ff",
      sdPrompt:
        "Extract component names, model numbers, port types, dimensions, weight, and specifications.",
    },
    warranty: {
      label: "Warranty",
      icon: "fa-solid fa-certificate",
      color: "#52c41a",
      sdPrompt:
        "Extract warranty duration, coverage terms, claim procedures, and support contacts.",
    },
    procedures: {
      label: "Procedures",
      icon: "fa-solid fa-list-check",
      color: "#fa8c16",
      sdPrompt:
        "Extract step-by-step instructions, setup guides, and maintenance procedures.",
    },
    errors: {
      label: "Errors & Diagnostics",
      icon: "fa-solid fa-circle-exclamation",
      color: "#eb2f96",
      sdPrompt:
        "Extract error codes, troubleshooting tables, diagnostic LED states, and problem/solution lists.",
    },
    video: {
      label: "Links & Tutorials",
      icon: "fa-solid fa-play-circle",
      color: "#722ed1",
      sdPrompt:
        "Extract URLs, QR codes, and references to video tutorials or online guides.",
    },
  };

  // --- Initialize ---
  initializeApp();

  function initializeApp() {
    // Apply theme
    document.documentElement.setAttribute("data-theme", state.theme);
    updateThemeIcon();

    // Load saved keys
    if (state.scaledownKey)
      document.getElementById("scaledown-key").value = state.scaledownKey;
    if (state.scaledownModel)
      document.getElementById("scaledown-model").value = state.scaledownModel;
    if (state.geminiKey)
      document.getElementById("gemini-key").value = state.geminiKey;

    // Fetch models
    fetchGeminiModels();

    // Render manual library
    renderManualLibrary();

    // Update metrics display
    updateMetricsDisplay();

    // Setup event listeners
    setupEventListeners();
  }

  function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener("click", () => {
      state.theme = state.theme === "light" ? "dark" : "light";
      localStorage.setItem("mn_theme", state.theme);
      document.documentElement.setAttribute("data-theme", state.theme);
      updateThemeIcon();
    });

    // Config modal
    configBtn.addEventListener("click", () => {
      openModal("config-modal");
    });

    // Library modal
    libraryBtn.addEventListener("click", () => {
      openModal("library-modal");
    });

    // Save keys
    saveKeysBtn.addEventListener("click", saveConfiguration);

    // File upload
    dropZone.addEventListener("click", () => pdfUpload.click());
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
    dropZone.addEventListener("dragleave", () =>
      dropZone.classList.remove("dragover"),
    );
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      if (e.dataTransfer.files[0]) handlePDF(e.dataTransfer.files[0]);
    });
    pdfUpload.addEventListener("change", (e) => handlePDF(e.target.files[0]));

    // Chat
    sendBtn.addEventListener("click", handleChat);
    userQuery.addEventListener(
      "keypress",
      (e) => e.key === "Enter" && handleChat(),
    );

    // Side navigation - slide panels
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => openSlidePanel(btn.dataset.panel));
    });

    // Panel close buttons
    document.querySelectorAll(".panel-close").forEach((btn) => {
      btn.addEventListener("click", () => closeSlidePanel(btn.dataset.close));
    });

    // Quick actions (chips in chat interface)
    document.querySelectorAll(".quick-chip").forEach((btn) => {
      btn.addEventListener("click", () =>
        handleQuickAction(btn.dataset.action),
      );
    });

    // Knowledge filters
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.addEventListener("click", () =>
        filterKnowledge(chip.dataset.filter),
      );
    });

    // Page search
    if (pageSearch) {
      pageSearch.addEventListener("input", (e) => filterPages(e.target.value));
    }

    // Troubleshooting
    const issueCategory = document.getElementById("issue-category");
    if (issueCategory) {
      issueCategory.addEventListener("change", (e) =>
        startTroubleshooting(e.target.value),
      );
    }

    // Error code lookup
    const lookupErrorBtn = document.getElementById("lookup-error-btn");
    const errorCodeInput = document.getElementById("error-code-input");
    if (lookupErrorBtn) {
      lookupErrorBtn.addEventListener("click", () =>
        lookupErrorCode(errorCodeInput.value),
      );
      errorCodeInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") lookupErrorCode(errorCodeInput.value);
      });
    }

    // Annotation tools
    document.querySelectorAll(".tool-btn[data-tool]").forEach((btn) => {
      btn.addEventListener("click", () =>
        selectAnnotationTool(btn.dataset.tool),
      );
    });

    const annotationColor = document.getElementById("annotation-color");
    if (annotationColor) {
      annotationColor.addEventListener(
        "change",
        (e) => (state.annotationColor = e.target.value),
      );
    }

    const clearAnnotations = document.getElementById("clear-annotations");
    if (clearAnnotations) {
      clearAnnotations.addEventListener("click", clearAllAnnotations);
    }

    const exportAnnotated = document.getElementById("export-annotated");
    if (exportAnnotated) {
      exportAnnotated.addEventListener("click", exportAnnotatedImage);
    }

    const annotatePageSelect = document.getElementById("annotate-page-select");
    if (annotatePageSelect) {
      annotatePageSelect.addEventListener("change", (e) =>
        loadPageForAnnotation(parseInt(e.target.value)),
      );
    }

    // Modals
    setupModalListeners();

    // Metrics & Survey buttons
    const metricsBtn = document.getElementById("metrics-btn");
    if (metricsBtn)
      metricsBtn.addEventListener("click", () => openModal("metrics-modal"));

    const surveyBtn = document.getElementById("survey-btn");
    if (surveyBtn)
      surveyBtn.addEventListener("click", () => openModal("survey-modal"));

    const crossSearchBtnHeader = document.getElementById(
      "cross-search-btn-header",
    );
    if (crossSearchBtnHeader) {
      crossSearchBtnHeader.addEventListener("click", () =>
        openModal("cross-search-modal"),
      );
    }

    // Survey interactions
    setupSurveyListeners();

    // Metrics export
    const exportCsv = document.getElementById("export-csv");
    if (exportCsv) exportCsv.addEventListener("click", exportMetricsCSV);

    const exportJson = document.getElementById("export-json");
    if (exportJson) exportJson.addEventListener("click", exportMetricsJSON);

    const resetMetrics = document.getElementById("reset-metrics");
    if (resetMetrics) resetMetrics.addEventListener("click", resetAllMetrics);

    // Cross-manual search
    const crossSearchBtn = document.getElementById("cross-search-btn");
    const crossSearchQuery = document.getElementById("cross-search-query");
    if (crossSearchBtn) {
      crossSearchBtn.addEventListener("click", () =>
        performCrossManualSearch(crossSearchQuery.value),
      );
      crossSearchQuery.addEventListener("keypress", (e) => {
        if (e.key === "Enter") performCrossManualSearch(crossSearchQuery.value);
      });
    }

    // Image modal actions
    const modalAnnotateBtn = document.getElementById("modal-annotate-btn");
    if (modalAnnotateBtn) {
      modalAnnotateBtn.addEventListener("click", () => {
        closeModal("image-modal");
        switchTab("annotate");
      });
    }

    const modalIdentifyBtn = document.getElementById("modal-identify-btn");
    if (modalIdentifyBtn) {
      modalIdentifyBtn.addEventListener("click", identifyPartsInImage);
    }

    // Refresh models button
    const refreshModelsBtn = document.getElementById("refresh-models-btn");
    if (refreshModelsBtn) {
      refreshModelsBtn.addEventListener("click", () => {
        fetchGeminiModels();
        showToast("Refreshing models...", "info");
      });
    }

    // Chat image upload - Attachment menu
    const attachImageBtn = document.getElementById("attach-image-btn");
    const attachMenu = document.getElementById("attach-menu");
    const chatImageInput = document.getElementById("chat-image-input");
    const removeChatImage = document.getElementById("remove-chat-image");

    if (attachImageBtn && attachMenu) {
      attachImageBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        attachMenu.classList.toggle("active");
      });

      // Close menu when clicking outside
      document.addEventListener("click", (e) => {
        if (!attachMenu.contains(e.target) && e.target !== attachImageBtn) {
          attachMenu.classList.remove("active");
        }
      });
    }

    // Attachment menu items
    const attachUpload = document.getElementById("attach-upload");
    const attachPdfPage = document.getElementById("attach-pdf-page");
    const attachAnnotated = document.getElementById("attach-annotated");

    if (attachUpload && chatImageInput) {
      attachUpload.addEventListener("click", () => {
        chatImageInput.click();
        attachMenu.classList.remove("active");
      });
      chatImageInput.addEventListener("change", handleChatImageSelect);
    }

    if (attachPdfPage) {
      attachPdfPage.addEventListener("click", () => {
        attachMenu.classList.remove("active");
        openPagePicker();
      });
    }

    if (attachAnnotated) {
      attachAnnotated.addEventListener("click", () => {
        attachMenu.classList.remove("active");
        insertAnnotatedPage();
      });
    }

    if (removeChatImage) {
      removeChatImage.addEventListener("click", clearChatImage);
    }

    // Chat with annotated page button in annotation panel
    const chatWithAnnotated = document.getElementById("chat-with-annotated");
    if (chatWithAnnotated) {
      chatWithAnnotated.addEventListener("click", chatWithAnnotatedPage);
    }

    // Paste image in chat
    document.addEventListener("paste", handlePasteImage);
  }

  function setupModalListeners() {
    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal(modal.id);
      });
      const closeBtn = modal.querySelector(".modal-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => closeModal(modal.id));
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay.active").forEach((modal) => {
          closeModal(modal.id);
        });
      }
    });
  }

  function setupSurveyListeners() {
    // Survey option buttons
    document.querySelectorAll(".survey-options").forEach((group) => {
      group.querySelectorAll(".survey-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          group
            .querySelectorAll(".survey-option")
            .forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
          const question = group.dataset.question;
          state.surveyData[question] = btn.dataset.value;
        });
      });
    });

    // Star rating
    const starRating = document.getElementById("star-rating");
    if (starRating) {
      starRating.querySelectorAll("i").forEach((star) => {
        star.addEventListener("click", () => {
          const rating = parseInt(star.dataset.rating);
          state.surveyData.rating = rating;
          updateStarDisplay(rating);
        });
        star.addEventListener("mouseenter", () => {
          updateStarDisplay(parseInt(star.dataset.rating));
        });
      });
      starRating.addEventListener("mouseleave", () => {
        updateStarDisplay(state.surveyData.rating);
      });
    }

    // Submit survey
    const submitSurvey = document.getElementById("submit-survey");
    if (submitSurvey) {
      submitSurvey.addEventListener("click", handleSurveySubmit);
    }
  }

  function updateStarDisplay(rating) {
    const stars = document.querySelectorAll("#star-rating i");
    stars.forEach((star, index) => {
      if (index < rating) {
        star.className = "fa-solid fa-star";
      } else {
        star.className = "fa-regular fa-star";
      }
    });
  }

  function updateThemeIcon() {
    const icon = themeToggle.querySelector("i");
    icon.className =
      state.theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
  }

  // --- Configuration ---
  function saveConfiguration() {
    state.scaledownKey = document.getElementById("scaledown-key").value.trim();
    state.scaledownModel = document.getElementById("scaledown-model").value;
    const newGeminiKey = document.getElementById("gemini-key").value.trim();
    state.geminiModel = modelSelect.value;

    const keyChanged = newGeminiKey !== state.geminiKey;
    state.geminiKey = newGeminiKey;

    localStorage.setItem("mn_scaledown_key", state.scaledownKey);
    localStorage.setItem("mn_scaledown_model", state.scaledownModel);
    localStorage.setItem("mn_gemini_key", state.geminiKey);
    localStorage.setItem("mn_gemini_model", state.geminiModel);

    if (keyChanged) fetchGeminiModels();

    closeModal("config-modal");
    showToast("Configuration saved!", "success");
  }

  // --- Model Fetching ---
  async function fetchGeminiModels() {
    if (!state.geminiKey) return;

    try {
      const currentSelection = state.geminiModel;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${state.geminiKey}`,
      );
      const data = await response.json();

      if (data.models) {
        modelSelect.innerHTML = "";

        // Include all models that support generateContent (text generation)
        // Exclude only non-text models (embeddings, TTS, image generation, etc.)
        const excluded = [
          "aqa",
          "tts",
          "embedding",
          "robotics",
          "veo",
          "deep-research",
          "imagen",
          "image-generation",
          "nano-banana",
          "banana",
          "learnlm",
          "computer-use",
        ];
        const excludedDisplayNames = [
          "nano banana",
          "image generation",
          "imagen",
        ];
        const filteredModels = data.models
          .filter((m) =>
            m.supportedGenerationMethods?.includes("generateContent"),
          )
          .filter(
            (m) => !excluded.some((tag) => m.name.toLowerCase().includes(tag)),
          )
          .filter(
            (m) =>
              !excludedDisplayNames.some((tag) =>
                m.displayName?.toLowerCase().includes(tag),
              ),
          )
          .filter((m) => {
            // Keep Gemini and Gemma models that support text generation
            const name = m.name.toLowerCase();
            return (
              name.includes("gemini-1.5") ||
              name.includes("gemini-2") ||
              name.includes("gemini-pro-vision") ||
              name.includes("gemma")
            );
          });

        filteredModels.sort((a, b) => {
          const idA = a.name.replace("models/", "");
          const idB = b.name.replace("models/", "");
          return idA.localeCompare(idB);
        });

        filteredModels.forEach((model) => {
          const modelId = model.name.replace("models/", "");
          const option = document.createElement("option");
          option.value = modelId;
          option.textContent = `${model.displayName} (${modelId})`;
          if (modelId === currentSelection) option.selected = true;
          modelSelect.appendChild(option);
        });

        if (!modelSelect.value && modelSelect.options.length > 0) {
          modelSelect.selectedIndex = 0;
          state.geminiModel = modelSelect.value;
        }
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
    }
  }

  // --- PDF Processing ---

  // Use Gemini vision to extract text from a page image when PDF.js can't
  async function extractTextFromPageImage(pdfPage, viewport) {
    const scale = 2;
    const ocrViewport = pdfPage.getViewport({ scale });
    const ocrCanvas = document.createElement("canvas");
    const ocrCtx = ocrCanvas.getContext("2d");
    ocrCanvas.width = ocrViewport.width;
    ocrCanvas.height = ocrViewport.height;

    await pdfPage.render({ canvasContext: ocrCtx, viewport: ocrViewport })
      .promise;
    const dataUrl = ocrCanvas.toDataURL("image/jpeg", 0.9);
    const base64 = dataUrl.split(",")[1];

    const prompt = `Extract ALL text visible in this page image. Include every word exactly as shown.
Preserve table structure: output each table row on its own line with columns separated by " | ".
Include numbered lists, labels, notes, headers, and footnotes. Do not summarize or paraphrase.`;

    const result = await callGemini(prompt, { base64, mimeType: "image/jpeg" });
    return result;
  }

  // Helper function to extract text from PDF - simple approach that preserves all text
  function extractStructuredText(items, viewport) {
    if (!items || items.length === 0) return "";

    // Group items by their Y position (rows) with tolerance
    const rowTolerance = 8; // pixels - increased for better row grouping
    const rows = [];

    items.forEach((item) => {
      // Include all text, even single characters
      if (!item.str) return;
      const text = item.str;
      if (text.length === 0) return;

      // Get transform - item.transform is [scaleX, skewX, skewY, scaleY, translateX, translateY]
      const x = item.transform ? item.transform[4] : 0;
      const y = item.transform ? viewport.height - item.transform[5] : 0;

      // Find existing row or create new one
      let foundRow = rows.find((row) => Math.abs(row.y - y) < rowTolerance);
      if (foundRow) {
        foundRow.items.push({ x, text: text, width: item.width || 0 });
      } else {
        rows.push({ y, items: [{ x, text: text, width: item.width || 0 }] });
      }
    });

    // Sort rows by Y position (top to bottom)
    rows.sort((a, b) => a.y - b.y);

    // Sort items within each row by X position (left to right)
    rows.forEach((row) => {
      row.items.sort((a, b) => a.x - b.x);
    });

    // Build text with proper spacing
    const lines = rows.map((row) => {
      const lineItems = [];
      let lastX = -1;
      let lastWidth = 0;

      row.items.forEach((item) => {
        // Add separator if there's a significant gap (column separator)
        if (lastX >= 0) {
          const gap = item.x - (lastX + lastWidth);
          if (gap > 15) {
            lineItems.push(" | ");
          } else if (gap > 2) {
            lineItems.push(" ");
          }
        }
        lineItems.push(item.text);
        lastX = item.x;
        lastWidth = item.width || item.text.length * 5;
      });

      return lineItems.join("").trim();
    });

    // Join lines with newlines, then normalize spaces within lines
    const result = lines
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .join("\n");

    return result;
  }

  async function handlePDF(file) {
    if (!file || file.type !== "application/pdf") {
      showToast("Please select a valid PDF file", "error");
      return;
    }

    document.getElementById("file-name").textContent = file.name;
    updateStatus("Processing Manual...");
    state.pdfPages = [];
    state.knowledgeBuckets = {};
    galleryGrid.innerHTML = "";

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;

      document.getElementById("page-count").textContent = `${totalPages} Pages`;

      // Process pages
      for (let i = 1; i <= totalPages; i++) {
        updateStatus(`Processing Page ${i}/${totalPages}...`);

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent({
          disableFontFace: true,
          includeMarkedContent: true,
          normalizeWhitespace: false,
        });

        let text = extractStructuredText(textContent.items, viewport);

        const annotations = await page.getAnnotations();
        const links = annotations
          .filter((a) => a.subtype === "Link" && a.url)
          .map((a) => a.url);

        // Render thumbnail
        const thumbViewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = thumbViewport.height;
        canvas.width = thumbViewport.width;

        await page.render({ canvasContext: context, viewport: thumbViewport })
          .promise;
        const imageSrc = canvas.toDataURL("image/jpeg", 0.8);

        // Vision OCR fallback: if PDF.js extracted very little text, use Gemini
        // to read the page image (handles tables rendered as images/vectors)
        if (text.length < 100 && state.geminiKey) {
          updateStatus(`OCR fallback for page ${i}/${totalPages}...`);
          try {
            const ocrText = await extractTextFromPageImage(page, viewport);
            if (ocrText && ocrText.length > text.length) {
              text = ocrText;
            }
          } catch (e) {
            // Keep original text if OCR fails
          }
        }

        state.pdfPages.push({ pageNum: i, text, imageSrc, links });
        addVisualToGallery(i, imageSrc, text.substring(0, 50));
      }

      // Save to library
      const manualId = Date.now().toString();
      state.currentManualId = manualId;

      const manualEntry = {
        id: manualId,
        name: file.name,
        pageCount: totalPages,
        dateAdded: new Date().toISOString(),
        pages: state.pdfPages,
      };

      state.manualLibrary.push(manualEntry);
      localStorage.setItem(
        "mn_manual_library",
        JSON.stringify(state.manualLibrary),
      );
      renderManualLibrary();

      // Extract knowledge
      updateStatus("Extracting Knowledge...");
      await extractKnowledge(state.pdfPages);

      // Update annotation page select
      updateAnnotationPageSelect();

      // Clear chat and add success message
      chatMessages.innerHTML = "";
      addMessage(
        `Manual "${file.name}" processed! Found ${totalPages} pages. Ask me anything about it.`,
        "bot",
      );

      // Log activity
      logActivity(
        "manual_upload",
        `Uploaded: ${file.name} (${totalPages} pages)`,
      );
    } catch (error) {
      console.error("PDF processing error:", error);
      showToast("Error processing PDF: " + error.message, "error");
      extractionStatus.textContent = "Processing failed";
      extractionStatus.style.color = "var(--safety-color)";
      sendBtn.disabled = true;
    }
  }

  function updateStatus(msg) {
    extractionStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> ${msg}`;
    extractionStatus.style.color = "var(--text-color)";
  }

  function addVisualToGallery(pageNum, src, caption) {
    const div = document.createElement("div");
    div.className = "gallery-item";
    div.dataset.page = pageNum;
    div.dataset.caption = caption.toLowerCase();
    div.innerHTML = `
            <img src="${src}" alt="Page ${pageNum}">
            <div class="gallery-caption">Page ${pageNum}</div>
        `;
    div.onclick = () => openImageModal(src, pageNum);
    galleryGrid.appendChild(div);
  }

  function filterPages(query) {
    const items = galleryGrid.querySelectorAll(".gallery-item");
    const lowerQuery = query.toLowerCase();

    items.forEach((item) => {
      const pageNum = item.dataset.page;
      const pageData = state.pdfPages.find(
        (p) => p.pageNum === parseInt(pageNum),
      );
      const matches =
        pageNum.includes(query) ||
        (pageData && pageData.text.toLowerCase().includes(lowerQuery));
      item.style.display = matches ? "block" : "none";
    });
  }

  // --- Knowledge Extraction ---
  async function extractKnowledge(pages) {
    state.isProcessing = true;
    sendBtn.disabled = true;

    try {
      const compressedPages = [];
      const totalPages = pages.length;

      for (let i = 0; i < totalPages; i++) {
        const page = pages[i];

        // For very short pages, preserve as-is without compression
        if (page.text.length < 50) {
          if (page.text.trim().length > 0) {
            compressedPages.push({ page: page.pageNum, text: page.text });
          }
          continue;
        }

        updateStatus(`Compressing page ${i + 1}/${totalPages}...`);

        try {
          const summary = await callScaleDown(
            page.text,
            `Clean and format this product manual page while preserving ALMOST ALL (95%+) of the content.

CRITICAL FORMATTING INSTRUCTIONS:
1.  **Reconstruct Tables & Lists:** PDF text extraction often jumbles columns. You MUST reorder these into a clean, sequential vertical list.
2.  **Use Pipe Separators:** If items are in columns, separate them with " | ". Example: "1. Card reader | 6. USB-A"
3.  **One Item Per Line:** Every numbered component, specification line, or warning must be on its own line.
4.  **Preserve Punctuation:** Keep all periods, commas, colons, and brackets exactly as they appear.

PRESERVE EXACTLY (Do NOT Filter):
• All text content (descriptions, notes, specs)
• All numbers and technical values
• All punctuation and formatting
• All columns and table structures

REMOVE ONLY:
• Repeated page headers/footers (e.g. "Legion Slim 5 16AHP9 PSREF...")
• Page numbers (e.g. "Page 5 of 8")
• Marketing slogans
• Unnecessary symbols (e.g. ™, ®, ©) where possible without breaking technical terms.

OUTPUT FORMAT (Generic Example):
1. [Component Name] | [Component Name]
2. [Component Name] - [Specifications with punctuation.]

[Section Title]
• [Detail 1] | [Detail 2]

Notes:
• [Note text with punctuation.]`,
            state.scaledownModel,
            0.95,
          );

          if (
            summary &&
            summary.length > 10 &&
            !summary.includes("unavailable") &&
            !summary.includes("Invalid")
          ) {
            compressedPages.push({ page: page.pageNum, text: summary });
          } else {
            compressedPages.push({ page: page.pageNum, text: page.text });
          }
        } catch (e) {
          compressedPages.push({ page: page.pageNum, text: page.text });
        }
      }

      // Send to Gemini for categorization
      updateStatus("Analyzing with AI...");

      const context = compressedPages
        .map((p) => `[PAGE ${p.page}]:\n${p.text}`)
        .join("\n\n");

      const systemPrompt = `You are a product manual categorizer. Extract and SPLIT content from each page into the CORRECT categories.

CATEGORY DEFINITIONS:

1. **safety** - Extract ONLY:
   - "WARNING", "CAUTION", "DANGER", "HAZARD" statements
   - Electric shock, fire, injury risks
   - Safety certifications (UL, CE safety marks)
   - "Do not" safety instructions

2. **parts** - Extract ONLY:
   - Hardware components (ports, connectors, buttons, slots)
   - Numbered component lists (1. Card reader, 2. USB-C...)
   - Technical specifications (CPU, RAM, storage, display)
   - Dimensions, weight, materials
   - Model numbers, part numbers
   - Performance specs (frequency, speed, capacity)
   - DO NOT include warranty text here

3. **warranty** - Extract ONLY:
   - Warranty duration ("1 year", "3 years", "limited warranty")
   - Coverage terms, limitations, exclusions
   - How to claim warranty
   - Contact info for warranty service
   - Any text containing "warranty", "coverage", "guarantee"

4. **procedures** - Extract ONLY:
   - Setup/installation steps
   - How-to instructions
   - Maintenance procedures
   - Configuration guides

5. **errors** - Extract ONLY:
   - Error codes (E001, Error 5...)
   - Troubleshooting steps
   - LED indicator meanings
   - "If X happens, do Y"

6. **video** - Extract ONLY:
   - URLs starting with http://, https://, or www.
   - QR codes
   - Video/support links

CRITICAL RULES:
- A SINGLE PAGE can appear in MULTIPLE categories if it has mixed content
- SPLIT the content: warranty text goes to warranty, specs go to parts
- Example: If page 6 has specs AND warranty info, create TWO entries:
  - {"page": 6, "text": "specs only..."} in parts
  - {"page": 6, "text": "warranty only..."} in warranty
- remove unnessary * and other symbols or trademarks.
- use newlines wherever necessary.
- Preserve line breaks in text
- Output format per item: {"page": number, "text": "relevant content only"}

OUTPUT: Valid JSON only:
{"safety":[],"parts":[],"warranty":[],"procedures":[],"errors":[],"video":[]}`;

      const fullPrompt = systemPrompt + "\n\nMANUAL CONTENT:\n" + context;

      let structuredData;

      // Try JSON mode first, fallback to regular call if model doesn't support it
      try {
        structuredData = await callGeminiJSON(fullPrompt);
      } catch (jsonError) {
        console.log(
          "JSON mode not supported by model, falling back to regular mode:",
          jsonError.message,
        );
        const rawResponse = await callGemini(fullPrompt);
        structuredData = parseJSONFromResponse(rawResponse);
      }

      // Ensure all categories exist
      ["safety", "parts", "warranty", "procedures", "errors", "video"].forEach(
        (cat) => {
          if (!structuredData[cat]) structuredData[cat] = [];
        },
      );

      processStructuredKnowledge(structuredData);
      renderKnowledgeGraph();
      renderKnowledgeList();

      const totalFound = Object.values(state.knowledgeBuckets).reduce(
        (acc, arr) => acc + arr.length,
        0,
      );
      extractionStatus.innerHTML = `<i class="fa-solid fa-check-circle" style="color: var(--warranty-color);"></i> Ready! Found ${totalFound} knowledge items`;
      extractionStatus.style.color = "var(--warranty-color)";
      showToast(`Extracted ${totalFound} knowledge items`, "success");
    } catch (err) {
      console.error("Extraction Error:", err);
      showToast("Knowledge extraction failed: " + err.message, "error");
      extractionStatus.innerHTML = `<i class="fa-solid fa-exclamation-circle"></i> Extraction failed`;
      extractionStatus.style.color = "var(--safety-color)";
    }

    state.isProcessing = false;
    sendBtn.disabled = false;
  }

  function processStructuredKnowledge(data) {
    // Build normalized knowledge buckets and hide empty/placeholder cards
    state.knowledgeBuckets = {};

    // Helper to determine if text is empty or just placeholder/filler
    function isPlaceholderText(t) {
      if (!t) return true;
      const cleaned = String(t).replace(/\s+/g, " ").trim();
      if (!cleaned) return true;
      // Common placeholders / short noise to ignore
      const lc = cleaned.toLowerCase();
      if (lc === "none" || lc === "n/a" || lc === "na" || lc === "-")
        return true;
      if (
        lc.startsWith("no ") ||
        lc.startsWith("none ") ||
        lc.startsWith("please visit")
      )
        return true;
      // Too short to be meaningful (e.g., single character or number)
      if (cleaned.length < 3) return true;
      return false;
    }

    Object.keys(CATEGORIES).forEach((key) => {
      const items = data[key] || [];
      if (!items || items.length === 0) return;

      const normalized = [];

      items.forEach((i) => {
        // Extract page number
        const page = i.page || 0;

        // Extract text - handle any shape Gemini returns
        let text = "";
        if (typeof i.text === "string") {
          text = i.text;
        } else {
          // Build text from all non-page fields (component, coverage, bundled, etc.)
          const parts = [];
          Object.entries(i).forEach(([k, v]) => {
            if (k === "page") return;
            if (typeof v === "string" && v.trim().length > 0) {
              parts.push(`${k}: ${v}`);
            } else if (Array.isArray(v) && v.length > 0) {
              parts.push(`${k}: ${v.join(", ")}`);
            } else if (typeof v === "object" && v !== null) {
              try {
                parts.push(`${k}: ${JSON.stringify(v)}`);
              } catch (e) {
                // ignore
              }
            }
          });
          text = parts.join(" | ");
        }

        const cleaned = (text || "").replace(/\s+/g, " ").trim();

        // Only include meaningful entries (hide placeholders/empty)
        if (!isPlaceholderText(cleaned)) {
          normalized.push({ page, text: cleaned });
        }
      });

      if (normalized.length > 0) {
        state.knowledgeBuckets[key] = normalized;
      }
    });
  }

  function renderKnowledgeGraph() {
    const container = knowledgeGraph;
    if (!container) return;

    const totalItems = Object.values(state.knowledgeBuckets).reduce(
      (acc, arr) => acc + arr.length,
      0,
    );

    if (totalItems === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-diagram-project" style="font-size: 2rem; opacity: 0.5;"></i>
                    <p>No structured knowledge found</p>
                </div>`;
      return;
    }

    let html = '<div class="knowledge-graph-visual">';
    html +=
      '<div class="graph-center"><i class="fa-solid fa-book"></i><span>Manual</span></div>';
    html += '<div class="graph-nodes">';

    Object.entries(CATEGORIES).forEach(([key, cat]) => {
      const items = state.knowledgeBuckets[key] || [];
      const count = items.length;
      if (count > 0) {
        html += `
                    <div class="graph-node" data-category="${key}" style="--node-color: ${cat.color}">
                        <i class="${cat.icon}"></i>
                        <span>${cat.label}</span>
                        <span class="node-count">${count}</span>
                    </div>`;
      }
    });

    html += "</div></div>";
    container.innerHTML = html;

    // Add click handlers to nodes
    container.querySelectorAll(".graph-node").forEach((node) => {
      node.addEventListener("click", () => {
        filterKnowledge(node.dataset.category);
      });
    });
  }

  function renderKnowledgeList(filter = "all") {
    if (!knowledgeList) return;

    let html = "";

    Object.entries(CATEGORIES).forEach(([key, cat]) => {
      if (filter !== "all" && filter !== key) return;

      const items = state.knowledgeBuckets[key] || [];
      if (items.length === 0) return;

      html += `<div class="knowledge-section" data-category="${key}">`;
      html += `<div class="ks-header" style="color: ${cat.color}">
                        <i class="${cat.icon}"></i>
                        <span>${cat.label}</span>
                        <span class="ks-count">${items.length} items</span>
                     </div>`;
      html += '<div class="ks-cards">';

      items.forEach((item) => {
        const displayText =
          item.text.length > 300
            ? item.text.substring(0, 300) + "..."
            : item.text;
        html += `
                    <div class="page-card" data-page="${item.page}" style="border-left: 3px solid ${cat.color}" title="${item.text.replace(/"/g, "&quot;")}">
                        <span class="pc-page" style="background: ${cat.color}">Page ${item.page}</span>
                        <p class="pc-overview">${displayText}</p>
                    </div>`;
      });

      html += "</div></div>";
    });

    if (!html) {
      html = `<div class="empty-state">
                        <i class="fa-solid fa-folder-open" style="font-size: 2rem; opacity: 0.5;"></i>
                        <p>No knowledge items found</p>
                    </div>`;
    }

    knowledgeList.innerHTML = html;

    // Add click handlers to cards
    knowledgeList.querySelectorAll(".page-card").forEach((card) => {
      card.addEventListener("click", () => {
        const pageNum = parseInt(card.dataset.page);
        const pageData = state.pdfPages.find((p) => p.pageNum === pageNum);
        if (pageData) {
          openImageModal(pageData.imageSrc, pageNum);
        }
      });
    });
  }

  function filterKnowledge(filter) {
    // Update active state on chips
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.filter === filter);
    });

    renderKnowledgeList(filter);
  }

  // --- Image Handling for Chat ---
  function handleChatImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result.split(",")[1];
      state.chatImageData = {
        base64: base64,
        mimeType: file.type,
        preview: event.target.result,
      };

      // Show preview
      const preview = document.getElementById("chat-image-preview");
      const previewImg = document.getElementById("chat-preview-img");
      if (preview && previewImg) {
        previewImg.src = event.target.result;
        preview.classList.remove("hidden");
      }

      // Enable send button
      sendBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  function handlePasteImage(e) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target.result.split(",")[1];
            state.chatImageData = {
              base64: base64,
              mimeType: file.type,
              preview: event.target.result,
            };

            const preview = document.getElementById("chat-image-preview");
            const previewImg = document.getElementById("chat-preview-img");
            if (preview && previewImg) {
              previewImg.src = event.target.result;
              preview.classList.remove("hidden");
            }

            sendBtn.disabled = false;
            showToast("Image pasted! Add a question and send.", "success");
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  }

  function clearChatImage() {
    state.chatImageData = null;
    const preview = document.getElementById("chat-image-preview");
    const chatImageInput = document.getElementById("chat-image-input");

    if (preview) preview.classList.add("hidden");
    if (chatImageInput) chatImageInput.value = "";

    // Update send button state
    const query = userQuery.value.trim();
    sendBtn.disabled = !query && state.pdfPages.length === 0;
  }

  function getAnnotatedPageImage() {
    const canvas = document.getElementById("annotation-canvas");
    const layer = document.getElementById("annotation-layer");

    if (!canvas || canvas.width === 0) {
      return null;
    }

    // Create a combined image of canvas + annotations
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext("2d");

    // Draw the base image
    ctx.drawImage(canvas, 0, 0);

    // Get scale factor - the canvas has internal dimensions but is displayed at CSS size
    // Annotations are positioned in CSS pixels (based on getBoundingClientRect)
    // Canvas internal size is typically 2x the CSS display size
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;

    // Skip DOM element drawing - use state.annotations only for consistent coordinates

    // Draw from state.annotations - these coordinates are in CSS pixels
    const pageNum = parseInt(
      document.getElementById("annotate-page-select")?.value || "0",
    );
    const annotations = state.annotations[pageNum] || [];

    annotations.forEach((ann) => {
      ctx.strokeStyle = ann.color || "#ff4d4f";
      ctx.fillStyle = ann.color || "#ff4d4f";
      ctx.lineWidth = 4;

      if (ann.type === "rect") {
        // Shape annotations use x1, y1, x2, y2 in CSS pixels
        const x1 = ann.x1 * scaleX;
        const y1 = ann.y1 * scaleY;
        const x2 = ann.x2 * scaleX;
        const y2 = ann.y2 * scaleY;
        const w = Math.abs(x2 - x1);
        const h = Math.abs(y2 - y1);
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), w, h);
      } else if (ann.type === "circle") {
        const x1 = ann.x1 * scaleX;
        const y1 = ann.y1 * scaleY;
        const x2 = ann.x2 * scaleX;
        const y2 = ann.y2 * scaleY;
        const w = Math.abs(x2 - x1);
        const h = Math.abs(y2 - y1);
        const cx = Math.min(x1, x2) + w / 2;
        const cy = Math.min(y1, y2) + h / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (ann.type === "marker") {
        const x = ann.x * scaleX;
        const y = ann.y * scaleY;
        // Draw pin marker
        ctx.beginPath();
        ctx.arc(x, y - 12 * scaleY, 10 * scaleX, 0, 2 * Math.PI);
        ctx.fill();
        // Draw pin stem
        ctx.beginPath();
        ctx.moveTo(x, y - 2 * scaleY);
        ctx.lineTo(x, y + 8 * scaleY);
        ctx.lineWidth = 4;
        ctx.stroke();
        if (ann.label) {
          ctx.font = `bold ${14 * scaleX}px Arial`;
          ctx.fillText(ann.label, x + 15 * scaleX, y);
        }
      } else if (ann.type === "text") {
        const x = ann.x * scaleX;
        const y = ann.y * scaleY;
        ctx.font = `bold ${16 * scaleX}px Arial`;
        ctx.fillText(ann.text || ann.label || "Text", x, y);
      } else if (ann.type === "arrow") {
        const x1 = ann.x1 * scaleX;
        const y1 = ann.y1 * scaleY;
        const x2 = ann.x2 * scaleX;
        const y2 = ann.y2 * scaleY;

        // Draw line
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLength = 20 * scaleX;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
          x2 - headLength * Math.cos(angle - Math.PI / 6),
          y2 - headLength * Math.sin(angle - Math.PI / 6),
        );
        ctx.lineTo(
          x2 - headLength * Math.cos(angle + Math.PI / 6),
          y2 - headLength * Math.sin(angle + Math.PI / 6),
        );
        ctx.closePath();
        ctx.fill();
      }
    });

    // Convert to base64
    const dataUrl = exportCanvas.toDataURL("image/jpeg", 0.9);
    const base64 = dataUrl.split(",")[1];

    return {
      base64: base64,
      mimeType: "image/jpeg",
      preview: dataUrl,
    };
  }

  function insertAnnotatedPage() {
    const imageData = getAnnotatedPageImage();

    if (!imageData) {
      showToast("Please select and annotate a page first", "warning");
      return;
    }

    state.chatImageData = imageData;

    // Show preview
    const preview = document.getElementById("chat-image-preview");
    const previewImg = document.getElementById("chat-preview-img");
    if (preview && previewImg) {
      previewImg.src = imageData.preview;
      preview.classList.remove("hidden");
    }

    sendBtn.disabled = false;
    userQuery.focus();
    userQuery.placeholder = "Ask about this annotated diagram...";

    showToast("Annotated image attached!", "success");
  }

  function chatWithAnnotatedPage() {
    const imageData = getAnnotatedPageImage();

    if (!imageData) {
      showToast("Please select a page to annotate first", "warning");
      return;
    }

    state.chatImageData = imageData;

    // Show preview
    const preview = document.getElementById("chat-image-preview");
    const previewImg = document.getElementById("chat-preview-img");
    if (preview && previewImg) {
      previewImg.src = imageData.preview;
      preview.classList.remove("hidden");
    }

    // Close the panel and focus chat
    closeSlidePanel("annotate");
    sendBtn.disabled = false;
    userQuery.focus();
    userQuery.placeholder = "Ask about this annotated diagram...";

    showToast("Annotated image ready! Ask a question about it.", "success");
  }

  function openPagePicker() {
    if (state.pdfPages.length === 0) {
      showToast("No PDF pages available. Upload a manual first.", "warning");
      return;
    }

    const grid = document.getElementById("page-picker-grid");
    grid.innerHTML = state.pdfPages
      .map(
        (page) => `
        <div class="page-picker-item" data-page="${page.pageNum}">
          <img src="${page.imageSrc}" alt="Page ${page.pageNum}">
          <span>Page ${page.pageNum}</span>
        </div>
      `,
      )
      .join("");

    // Add click handlers
    grid.querySelectorAll(".page-picker-item").forEach((item) => {
      item.addEventListener("click", () => {
        const pageNum = parseInt(item.dataset.page);
        insertPdfPage(pageNum);
        closeModal("page-picker-modal");
      });
    });

    openModal("page-picker-modal");
  }

  function insertPdfPage(pageNum) {
    const pageData = state.pdfPages.find((p) => p.pageNum === pageNum);
    if (!pageData) {
      showToast("Page not found", "error");
      return;
    }

    // Convert image src to base64
    const base64 = pageData.imageSrc.split(",")[1];
    const mimeType = pageData.imageSrc.startsWith("data:image/png")
      ? "image/png"
      : "image/jpeg";

    state.chatImageData = {
      base64: base64,
      mimeType: mimeType,
      preview: pageData.imageSrc,
    };

    // Show preview
    const preview = document.getElementById("chat-image-preview");
    const previewImg = document.getElementById("chat-preview-img");
    if (preview && previewImg) {
      previewImg.src = pageData.imageSrc;
      preview.classList.remove("hidden");
    }

    sendBtn.disabled = false;
    userQuery.focus();
    userQuery.placeholder = `Ask about page ${pageNum}...`;

    showToast(`Page ${pageNum} attached!`, "success");
  }

  // --- Chat Logic ---
  async function handleChat() {
    const query = userQuery.value.trim();
    const hasImage = state.chatImageData !== null;

    if (!query && !hasImage) return;
    if (state.isProcessing) return;

    // Show user message with image preview if attached
    const imagePreview = hasImage ? state.chatImageData.preview : null;
    addMessage(
      query || "What can you tell me about this image?",
      "user",
      imagePreview,
    );
    userQuery.value = "";
    userQuery.placeholder = "Ask about the product...";
    const loaderId = addMessage("Analyzing...", "bot");

    // Track metrics
    state.metrics.totalQueries++;
    logActivity("query", query.substring(0, 50));

    try {
      // Detect intent
      let category = "procedures";
      const lowerQuery = query.toLowerCase();

      if (lowerQuery.match(/safe|warning|danger|hazard|caution/))
        category = "safety";
      else if (lowerQuery.match(/part|spec|dimension|weight|model|cpu|ram|gpu/))
        category = "parts";
      else if (lowerQuery.match(/warranty|coverage|support|contact|claim/))
        category = "warranty";
      else if (
        lowerQuery.match(/error|code|diagnostic|troubleshoot|problem|fix/)
      )
        category = "errors";
      else if (lowerQuery.match(/video|tutorial|link|url|guide/))
        category = "video";

      // Update category stats
      state.metrics.categoryStats[category]++;

      // Get context
      let context = "";
      if (state.knowledgeBuckets[category]) {
        context = state.knowledgeBuckets[category]
          .map((i) => `[Page ${i.page}] ${i.text}`)
          .join("\n---\n");
      }

      if (!context) {
        context = Object.values(state.knowledgeBuckets)
          .flat()
          .map((i) => `[Page ${i.page}] ${i.text}`)
          .join("\n");
      }

      if (!context && state.pdfPages.length > 0) {
        context = state.pdfPages
          .map((p) => `[Page ${p.pageNum}] ${p.text}`)
          .join("\n")
          .substring(0, 30000);
      }

      const prompt = `Context from manual (${category} category):
${context || "No context available."}

User Question: ${query || "What can you tell me about this image?"}

Instructions:
- Answer using the context provided
- Be helpful and concise
- Reference page numbers when available
- If not in context, say so but try to help
- Use markdown formatting
${hasImage ? "- An image has been provided. Analyze it in the context of the manual." : ""}`;

      const response = await callGemini(prompt, state.chatImageData);
      updateMessage(loaderId, marked.parse(response));

      // Clear image after sending
      clearChatImage();

      // Assume resolved if we got a response
      state.metrics.resolvedQueries++;
      saveMetrics();
    } catch (error) {
      updateMessage(
        loaderId,
        "I encountered an error. Please check your API keys and try again.",
      );
    }
  }

  function addMessage(text, type, imagePreview = null) {
    const id =
      "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
    const div = document.createElement("div");
    div.className = `message ${type}`;
    div.id = id;
    const imgHtml = imagePreview
      ? `<img src="${imagePreview}" class="message-image" alt="Uploaded image">`
      : "";
    div.innerHTML = `<div class="message-content">${imgHtml}${text}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return id;
  }

  function updateMessage(id, html) {
    const msg = document.getElementById(id);
    if (msg) {
      msg.querySelector(".message-content").innerHTML = html;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  // --- Quick Actions ---
  function handleQuickAction(action) {
    switch (action) {
      case "safety":
        openSafetyModal();
        break;
      case "warranty":
        openWarrantyModal();
        break;
      case "troubleshoot":
        switchTab("troubleshoot");
        break;
      case "parts":
        openPartsModal();
        break;
    }
  }

  async function openSafetyModal() {
    openModal("safety-modal");
    const content = document.getElementById("safety-content");

    const safetyItems = state.knowledgeBuckets.safety || [];

    if (safetyItems.length === 0) {
      content.innerHTML = `
                <div class="modal-empty">
                    <i class="fa-solid fa-check-circle"></i>
                    <p>No specific safety warnings found in this manual.</p>
                </div>`;
      return;
    }

    let html = '<div class="safety-warnings">';
    safetyItems.forEach((item, idx) => {
      html += `
                <div class="safety-warning-card">
                    <div class="warning-header">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span>Warning ${idx + 1}</span>
                        <span class="warning-page">Page ${item.page}</span>
                    </div>
                    <p>${item.text}</p>
                </div>`;
    });
    html += "</div>";

    content.innerHTML = html;
    state.metrics.categoryStats.safety++;
    logActivity("view", "Safety warnings");
  }

  async function openWarrantyModal() {
    openModal("warranty-modal");
    const content = document.getElementById("warranty-content");

    const warrantyItems = state.knowledgeBuckets.warranty || [];

    if (warrantyItems.length === 0) {
      content.innerHTML = `
                <div class="modal-empty">
                    <i class="fa-solid fa-info-circle"></i>
                    <p>No warranty information found in this manual.</p>
                </div>`;
      return;
    }

    let html = '<div class="warranty-info">';
    warrantyItems.forEach((item) => {
      html += `
                <div class="warranty-card">
                    <span class="warranty-page">Page ${item.page}</span>
                    <p>${item.text}</p>
                </div>`;
    });
    html += "</div>";

    content.innerHTML = html;
    state.metrics.categoryStats.warranty++;
    logActivity("view", "Warranty information");
  }

  /**
   * Parse JSON from LLM response - handles various output formats
   * Works with all models (Gemini, Gemma, etc.) regardless of JSON mode support
   * @param {string} response - Raw LLM response text
   * @returns {object} Parsed JSON object
   */
  function parseJSONFromResponse(response) {
    // Clean the response
    let cleaned = response.trim();

    // Remove markdown code fences if present
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    // Try direct parse first
    try {
      return JSON.parse(cleaned);
    } catch (e1) {
      // Direct parse failed, try extracting JSON object
    }

    // Find JSON object boundaries
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("No valid JSON object found in response");
    }

    let jsonStr = cleaned.substring(firstBrace, lastBrace + 1);

    // Try parsing the extracted JSON
    try {
      return JSON.parse(jsonStr);
    } catch (e2) {
      // Standard parse failed, attempt to fix common issues
    }

    // Fix common JSON issues from LLM outputs
    try {
      // Fix unescaped newlines in strings
      jsonStr = jsonStr.replace(/(?<=":.*"[^"]*)\n(?=[^"]*")/g, "\\n");
      // Fix trailing commas
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, "$1");
      // Fix single quotes (some models use them)
      jsonStr = jsonStr.replace(/'/g, '"');

      return JSON.parse(jsonStr);
    } catch (e3) {
      throw new Error("Could not parse JSON from response: " + e3.message);
    }
  }

  /**
   * Format parts/specs text into structured HTML display
   * Handles various formats: "Component: specs", bullet lists, comma-separated, etc.
   * @param {string} text - Raw text from extraction
   * @returns {string} HTML string for display
   */
  function formatPartText(text) {
    // Check for pipe separators (table row)
    if (text.includes(" | ")) {
      const parts = text.split(" | ").map(p => p.trim());
      let html = '<div class="part-content part-table-row" style="display: flex; gap: 10px; flex-wrap: wrap;">';

      parts.forEach(part => {
        // Check if it looks like a component "1. Card reader"
        if (part.match(/^\d+\./)) {
          html += `<div class="spec-item spec-tag" style="background: var(--bg-secondary); border: 1px solid var(--border-color); font-weight: 500;">
                <span class="spec-value">${escapeHtml(part)}</span>
             </div>`;
        }
        // Check if it looks like a key-value "Motor: 2.5HP"
        else if (part.includes(":")) {
          const [label, val] = part.split(/:\s*(.+)/);
          if (val) {
            html += `<div class="spec-item">
                    <span class="spec-label">${escapeHtml(label.trim())}</span>
                    <span class="spec-value">${escapeHtml(val.trim())}</span>
                 </div>`;
          } else {
            html += `<div class="spec-item spec-tag"><span class="spec-value">${escapeHtml(part)}</span></div>`;
          }
        }
        else {
          html += `<div class="spec-item spec-tag"><span class="spec-value">${escapeHtml(part)}</span></div>`;
        }
      });
      html += "</div>";
      return html;
    }

    // Clean up text - remove excessive whitespace and normalize bullets
    let cleanText = text
      .replace(/\s+/g, " ")
      .replace(/\s*[•·]\s*/g, " • ")
      .trim();

    // Split by bullets if present
    if (cleanText.includes("•")) {
      const parts = cleanText
        .split("•")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (parts.length > 1) {
        let html = '<div class="part-content"><div class="part-specs-list">';
        parts.forEach((part) => {
          // Skip filler text like "Notes", "For more...", etc.
          if (
            part.toLowerCase().startsWith("notes") ||
            part.toLowerCase().startsWith("for more") ||
            part.toLowerCase().startsWith("please visit")
          ) {
            return;
          }
          html += `<div class="spec-list-item">• ${escapeHtml(part)}</div>`;
        });
        html += "</div></div>";
        return html;
      }
    }

    // Check if this is a "Component: specs" format (e.g., "Motor: 2.5HP, 3600 RPM")
    const mainComponentMatch = cleanText.match(/^([^:]+):\s*(.+)$/);

    if (mainComponentMatch) {
      const componentName = mainComponentMatch[1].trim();
      const specsText = mainComponentMatch[2].trim();

      // Skip if component name looks like filler/notes
      if (
        componentName.toLowerCase().includes("note") ||
        componentName.toLowerCase().includes("please") ||
        componentName.toLowerCase().includes("visit")
      ) {
        return `<p class="part-note">${escapeHtml(cleanText)}</p>`;
      }

      // Split specs by comma, handling units and measurements
      const specs = specsText.split(/,\s*/).filter((s) => s.length > 0);

      let html = '<div class="part-content">';
      html += `<div class="part-component-name">${escapeHtml(componentName)}</div>`;
      html += '<div class="part-specs-grid">';

      specs.forEach((spec) => {
        // Skip notes/filler within specs
        if (
          spec.toLowerCase().startsWith("note") ||
          spec.toLowerCase().startsWith("for more") ||
          spec.toLowerCase().startsWith("please")
        ) {
          return;
        }

        // Short specs -> always chip
        const isShortSpec = spec.length < 20;

        // Only use label-value for longer specs with clear word labels (3+ chars)
        const labelValueMatch = spec.match(
          /^([A-Za-z]{3,}[A-Za-z\s]*?)\s+([\d][^\s]*.*?)$/,
        );

        if (labelValueMatch && !isShortSpec) {
          html += `<div class="spec-item">
            <span class="spec-label">${escapeHtml(labelValueMatch[1].trim())}</span>
            <span class="spec-value">${escapeHtml(labelValueMatch[2].trim())}</span>
          </div>`;
        } else {
          html += `<div class="spec-item spec-tag">
            <span class="spec-value">${escapeHtml(spec)}</span>
          </div>`;
        }
      });

      html += "</div></div>";
      return html;
    }

    // Handle standalone text without colon (list of features)
    if (!cleanText.includes(":") && cleanText.includes(",")) {
      const features = cleanText.split(/,\s*/).filter((f) => f.length > 0);
      if (features.length > 1) {
        let html = '<div class="part-content">';
        html += '<div class="part-specs-grid">';
        features.forEach((feature) => {
          html += `<div class="spec-item spec-tag">
            <span class="spec-value">${escapeHtml(feature.trim())}</span>
          </div>`;
        });
        html += "</div></div>";
        return html;
      }
    }

    // Try to detect multiple key-value pairs (multiline format)
    const lines = text
      .split(/[\n;]/)
      .map((l) => l.trim())
      .filter((l) => l);

    const specPattern = /^([^:]+):\s*(.+)$/;
    const hasSpecs = lines.some((line) => specPattern.test(line));

    if (hasSpecs && lines.length > 1) {
      let html = '<div class="part-content">';
      lines.forEach((line) => {
        const match = line.match(specPattern);
        if (match) {
          html += `<div class="part-spec-row">
            <span class="spec-label">${escapeHtml(match[1].trim())}</span>
            <span class="spec-value">${escapeHtml(match[2].trim())}</span>
          </div>`;
        } else if (line.length > 0) {
          html += `<div class="part-spec-row">
            <span class="spec-value" style="flex-basis: 100%">${escapeHtml(line)}</span>
          </div>`;
        }
      });
      html += "</div>";
      return html;
    }

    // Fallback to formatted paragraph for plain text
    return `<p>${escapeHtml(text)}</p>`;
  }

  // Helper to escape HTML
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Helper to highlight search terms
  function highlightSearchTerm(html, query) {
    if (!query || query.length < 2) return html;
    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi",
    );
    return html.replace(regex, '<span class="search-highlight">$1</span>');
  }

  async function openPartsModal() {
    openModal("parts-modal");
    const content = document.getElementById("parts-content");
    const searchInput = document.getElementById("parts-search-input");

    const partsItems = state.knowledgeBuckets.parts || [];

    if (partsItems.length === 0) {
      content.innerHTML = `
                <div class="modal-empty">
                    <i class="fa-solid fa-info-circle"></i>
                    <p>No parts/specifications found in this manual.</p>
                </div>`;
      return;
    }

    // Store original items for filtering
    const originalItems = partsItems.map((item) => ({
      page: item.page,
      text: item.text,
      formattedHtml: formatPartText(item.text),
    }));

    function renderPartsList(query = "") {
      let html = '<div class="parts-list">';
      const lowerQuery = query.toLowerCase();

      originalItems.forEach((item) => {
        const matchesQuery =
          !query || item.text.toLowerCase().includes(lowerQuery);
        if (!matchesQuery) return;

        let displayHtml = item.formattedHtml;
        if (query) {
          displayHtml = highlightSearchTerm(displayHtml, query);
        }

        html += `
                <div class="part-card" data-text="${item.text.replace(/"/g, "&quot;")}">
                    <span class="part-page">Page ${item.page}</span>
                    ${displayHtml}
                </div>`;
      });
      html += "</div>";

      if (html === '<div class="parts-list"></div>') {
        html = `<div class="modal-empty">
                    <i class="fa-solid fa-search"></i>
                    <p>No parts matching "${escapeHtml(query)}"</p>
                </div>`;
      }

      content.innerHTML = html;
    }

    renderPartsList();

    // Setup search filter with highlighting
    if (searchInput) {
      // Remove old listener by cloning
      const newSearchInput = searchInput.cloneNode(true);
      searchInput.parentNode.replaceChild(newSearchInput, searchInput);

      newSearchInput.value = "";
      newSearchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        renderPartsList(query);
      });
    }

    state.metrics.categoryStats.parts++;
    logActivity("view", "Parts & Specifications");
  }

  // --- Troubleshooting ---
  async function startTroubleshooting(category) {
    const workflow = document.getElementById("diagnostic-workflow");
    if (!category) {
      workflow.innerHTML = `
                <div class="workflow-empty">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    <p>Select an issue category above to start troubleshooting.</p>
                </div>`;
      return;
    }

    workflow.innerHTML = `
            <div class="workflow-loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>Generating troubleshooting steps...</p>
            </div>`;

    // Get relevant procedures and errors
    const procedures = state.knowledgeBuckets.procedures || [];
    const errors = state.knowledgeBuckets.errors || [];
    const context = [...procedures, ...errors]
      .map((i) => `[Page ${i.page}] ${i.text}`)
      .join("\n");

    const categoryLabels = {
      power: "Power / Won't Turn On",
      display: "Display Issues",
      audio: "Audio Problems",
      connectivity: "Connectivity Issues",
      performance: "Performance / Slow",
      overheating: "Overheating",
      "error-codes": "Error Codes",
      other: "General Issues",
    };

    const prompt = `Based on the manual content, create a step-by-step troubleshooting guide for "${categoryLabels[category]}" issues.

Manual Context:
${context || "No specific troubleshooting information available."}

Create a structured troubleshooting workflow with:
1. Initial checks (3-5 quick things to verify)
2. Step-by-step diagnostic process
3. Common solutions
4. When to contact support

Format as markdown with clear numbered steps and checkboxes where appropriate.`;

    try {
      const response = await callGemini(prompt);
      workflow.innerHTML = `
                <div class="workflow-content">
                    <div class="workflow-steps">
                        ${marked.parse(response)}
                    </div>
                </div>`;

      state.metrics.categoryStats.procedures++;
      logActivity("troubleshoot", categoryLabels[category]);
    } catch (error) {
      workflow.innerHTML = `
                <div class="workflow-error">
                    <i class="fa-solid fa-exclamation-circle"></i>
                    <p>Failed to generate troubleshooting guide. Please try again.</p>
                </div>`;
    }
  }

  async function lookupErrorCode(code) {
    const resultDiv = document.getElementById("error-result");
    if (!code.trim()) {
      resultDiv.innerHTML =
        '<p class="error-hint">Enter an error code to look up</p>';
      return;
    }

    resultDiv.innerHTML = `
            <div class="error-loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>Looking up error code...</p>
            </div>`;

    const errors = state.knowledgeBuckets.errors || [];
    const context = errors.map((i) => `[Page ${i.page}] ${i.text}`).join("\n");

    const prompt = `Look up error code "${code}" in the manual content.

Manual Error Information:
${context || "No error code information available."}

If the error code is found:
- Explain what it means
- Provide steps to resolve it
- Reference the page number

If not found:
- Indicate the code wasn't found in the manual
- Provide general troubleshooting advice

Format response clearly with markdown.`;

    try {
      const response = await callGemini(prompt);
      resultDiv.innerHTML = `
                <div class="error-result-content">
                    <h5>Results for "${code}"</h5>
                    ${marked.parse(response)}
                </div>`;

      state.metrics.categoryStats.errors++;
      logActivity("error_lookup", code);
    } catch (error) {
      resultDiv.innerHTML = `
                <div class="error-not-found">
                    <i class="fa-solid fa-question-circle"></i>
                    <p>Error lookup failed. Please try again.</p>
                </div>`;
    }
  }

  // --- Annotations ---
  function selectAnnotationTool(tool) {
    state.currentTool = tool;
    document.querySelectorAll(".tool-btn[data-tool]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === tool);
    });
  }

  function updateAnnotationPageSelect() {
    const select = document.getElementById("annotate-page-select");
    if (!select) return;

    select.innerHTML = '<option value="">-- Select a page --</option>';
    state.pdfPages.forEach((page) => {
      const option = document.createElement("option");
      option.value = page.pageNum;
      option.textContent = `Page ${page.pageNum}`;
      select.appendChild(option);
    });
  }

  function loadPageForAnnotation(pageNum) {
    const container = document.getElementById("annotation-canvas-container");
    const canvas = document.getElementById("annotation-canvas");
    const layer = document.getElementById("annotation-layer");

    if (!pageNum || !container || !canvas) return;

    const pageData = state.pdfPages.find((p) => p.pageNum === pageNum);
    if (!pageData) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Load existing annotations
      loadAnnotationsForPage(pageNum);

      // Setup drawing handlers
      setupAnnotationHandlers(canvas, layer, pageNum);
    };
    img.src = pageData.imageSrc;
  }

  function setupAnnotationHandlers(canvas, layer, pageNum) {
    let isDrawing = false;
    let startX, startY;
    let currentElement = null;

    canvas.onmousedown = (e) => {
      if (state.currentTool === "select") return;

      const rect = canvas.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      isDrawing = true;

      if (state.currentTool === "marker") {
        addMarkerAnnotation(startX, startY, pageNum);
        isDrawing = false;
      } else if (state.currentTool === "text") {
        addTextAnnotation(startX, startY, pageNum);
        isDrawing = false;
      } else {
        currentElement = createShapeElement(state.currentTool, startX, startY);
        layer.appendChild(currentElement);
      }
    };

    canvas.onmousemove = (e) => {
      if (!isDrawing || !currentElement) return;

      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      updateShapeElement(
        currentElement,
        state.currentTool,
        startX,
        startY,
        currentX,
        currentY,
      );
    };

    canvas.onmouseup = (e) => {
      if (!isDrawing) return;
      isDrawing = false;

      if (currentElement) {
        const rect = canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        saveShapeAnnotation(
          state.currentTool,
          startX,
          startY,
          endX,
          endY,
          pageNum,
        );
        currentElement = null;
      }
    };
  }

  function createShapeElement(tool, x, y) {
    const el = document.createElement("div");
    el.className = `annotation-shape annotation-${tool}`;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.borderColor = state.annotationColor;
    if (tool === "arrow") {
      el.style.backgroundColor = state.annotationColor;
    }
    return el;
  }

  function updateShapeElement(el, tool, x1, y1, x2, y2) {
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    el.style.left = Math.min(x1, x2) + "px";
    el.style.top = Math.min(y1, y2) + "px";
    el.style.width = width + "px";
    el.style.height = height + "px";

    if (tool === "arrow") {
      const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      el.style.transform = `rotate(${angle}deg)`;
      el.style.transformOrigin = "left center";
      el.style.width = Math.sqrt(width * width + height * height) + "px";
      el.style.height = "3px";
      el.style.left = x1 + "px";
      el.style.top = y1 + "px";
    }
  }

  function addMarkerAnnotation(x, y, pageNum) {
    const layer = document.getElementById("annotation-layer");
    const marker = document.createElement("div");
    marker.className = "annotation-marker";
    marker.style.left = x + "px";
    marker.style.top = y + "px";
    marker.style.color = state.annotationColor;
    marker.innerHTML = '<i class="fa-solid fa-location-dot"></i>';
    layer.appendChild(marker);

    const label = prompt("Enter marker label:");
    if (label) {
      marker.title = label;
      saveAnnotation(pageNum, {
        type: "marker",
        x,
        y,
        label,
        color: state.annotationColor,
      });
      updateAnnotationList(pageNum);
    } else {
      marker.remove();
    }
  }

  function addTextAnnotation(x, y, pageNum) {
    const text = prompt("Enter annotation text:");
    if (!text) return;

    const layer = document.getElementById("annotation-layer");
    const textEl = document.createElement("div");
    textEl.className = "annotation-text";
    textEl.style.left = x + "px";
    textEl.style.top = y + "px";
    textEl.style.color = state.annotationColor;
    textEl.textContent = text;
    layer.appendChild(textEl);

    saveAnnotation(pageNum, {
      type: "text",
      x,
      y,
      text,
      color: state.annotationColor,
    });
    updateAnnotationList(pageNum);
  }

  function saveShapeAnnotation(tool, x1, y1, x2, y2, pageNum) {
    saveAnnotation(pageNum, {
      type: tool,
      x1,
      y1,
      x2,
      y2,
      color: state.annotationColor,
    });
    updateAnnotationList(pageNum);
  }

  function saveAnnotation(pageNum, annotation) {
    if (!state.annotations[pageNum]) {
      state.annotations[pageNum] = [];
    }
    annotation.id = Date.now();
    state.annotations[pageNum].push(annotation);
    localStorage.setItem("mn_annotations", JSON.stringify(state.annotations));
  }

  function loadAnnotationsForPage(pageNum) {
    const layer = document.getElementById("annotation-layer");
    layer.innerHTML = "";

    const annotations = state.annotations[pageNum] || [];
    annotations.forEach((ann) => {
      renderAnnotation(layer, ann);
    });

    updateAnnotationList(pageNum);
  }

  function renderAnnotation(layer, ann) {
    let el;

    if (ann.type === "marker") {
      el = document.createElement("div");
      el.className = "annotation-marker";
      el.style.left = ann.x + "px";
      el.style.top = ann.y + "px";
      el.style.color = ann.color;
      el.innerHTML = '<i class="fa-solid fa-location-dot"></i>';
      el.title = ann.label;
    } else if (ann.type === "text") {
      el = document.createElement("div");
      el.className = "annotation-text";
      el.style.left = ann.x + "px";
      el.style.top = ann.y + "px";
      el.style.color = ann.color;
      el.textContent = ann.text;
    } else {
      el = document.createElement("div");
      el.className = `annotation-shape annotation-${ann.type}`;
      el.style.borderColor = ann.color;

      const width = Math.abs(ann.x2 - ann.x1);
      const height = Math.abs(ann.y2 - ann.y1);

      el.style.left = Math.min(ann.x1, ann.x2) + "px";
      el.style.top = Math.min(ann.y1, ann.y2) + "px";
      el.style.width = width + "px";
      el.style.height = height + "px";

      if (ann.type === "arrow") {
        const angle =
          (Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1) * 180) / Math.PI;
        el.style.transform = `rotate(${angle}deg)`;
        el.style.transformOrigin = "left center";
        el.style.width = Math.sqrt(width * width + height * height) + "px";
        el.style.height = "3px";
        el.style.left = ann.x1 + "px";
        el.style.top = ann.y1 + "px";
        el.style.backgroundColor = ann.color;
      }
    }

    el.dataset.id = ann.id;
    layer.appendChild(el);
  }

  function updateAnnotationList(pageNum) {
    const list = document.getElementById("annotation-items");
    if (!list) return;

    const annotations = state.annotations[pageNum] || [];

    if (annotations.length === 0) {
      list.innerHTML = '<li class="empty-annotations">No annotations yet</li>';
      return;
    }

    list.innerHTML = annotations
      .map(
        (ann) => `
            <li class="annotation-item" data-id="${ann.id}">
                <span class="ann-type">${ann.type}</span>
                <span class="ann-label">${ann.label || ann.text || "Shape"}</span>
                <button class="ann-delete" onclick="deleteAnnotation(${pageNum}, ${ann.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </li>
        `,
      )
      .join("");
  }

  window.deleteAnnotation = function (pageNum, id) {
    state.annotations[pageNum] = state.annotations[pageNum].filter(
      (a) => a.id !== id,
    );
    localStorage.setItem("mn_annotations", JSON.stringify(state.annotations));
    loadAnnotationsForPage(pageNum);
  };

  function clearAllAnnotations() {
    const pageNum = parseInt(
      document.getElementById("annotate-page-select").value,
    );
    if (!pageNum) return;

    if (confirm("Clear all annotations on this page?")) {
      state.annotations[pageNum] = [];
      localStorage.setItem("mn_annotations", JSON.stringify(state.annotations));
      loadAnnotationsForPage(pageNum);
    }
  }

  function exportAnnotatedImage() {
    const canvas = document.getElementById("annotation-canvas");
    const layer = document.getElementById("annotation-layer");

    if (!canvas) return;

    // Create export canvas
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext("2d");

    // Draw base image
    ctx.drawImage(canvas, 0, 0);

    // Draw annotations (simplified)
    const pageNum = parseInt(
      document.getElementById("annotate-page-select").value,
    );
    const annotations = state.annotations[pageNum] || [];

    annotations.forEach((ann) => {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = 2;

      if (ann.type === "rect") {
        ctx.strokeRect(ann.x1, ann.y1, ann.x2 - ann.x1, ann.y2 - ann.y1);
      } else if (ann.type === "circle") {
        ctx.beginPath();
        const rx = Math.abs(ann.x2 - ann.x1) / 2;
        const ry = Math.abs(ann.y2 - ann.y1) / 2;
        const cx = Math.min(ann.x1, ann.x2) + rx;
        const cy = Math.min(ann.y1, ann.y2) + ry;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (ann.type === "marker") {
        ctx.beginPath();
        ctx.arc(ann.x, ann.y, 10, 0, 2 * Math.PI);
        ctx.fill();
      } else if (ann.type === "text") {
        ctx.font = "16px Arial";
        ctx.fillText(ann.text, ann.x, ann.y);
      }
    });

    // Download
    const link = document.createElement("a");
    link.download = `annotated-page-${pageNum}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();

    showToast("Annotated image exported!", "success");
  }

  // --- Metrics ---
  function updateMetricsDisplay() {
    document.getElementById("total-queries").textContent =
      state.metrics.totalQueries;
    document.getElementById("resolved-queries").textContent =
      state.metrics.resolvedQueries;
    document.getElementById("tickets-prevented").textContent =
      state.metrics.ticketsPrevented;

    const reduction =
      state.metrics.totalQueries > 0
        ? Math.round(
          (state.metrics.ticketsPrevented / state.metrics.totalQueries) * 100,
        )
        : 0;
    document.getElementById("reduction-rate").textContent = `${reduction}%`;

    // Update category bars
    const maxCat = Math.max(...Object.values(state.metrics.categoryStats), 1);
    Object.entries(state.metrics.categoryStats).forEach(([cat, count]) => {
      const bar = document.querySelector(`.${cat}-bar`);
      const value = document.querySelector(`.cat-value[data-cat="${cat}"]`);
      if (bar) bar.style.width = `${(count / maxCat) * 100}%`;
      if (value) value.textContent = count;
    });

    // Update satisfaction
    const ratings = state.metrics.ratings;
    const totalRatings = Object.values(ratings).reduce((a, b) => a + b, 0);
    const weightedSum = Object.entries(ratings).reduce(
      (sum, [r, c]) => sum + parseInt(r) * c,
      0,
    );
    const avgRating =
      totalRatings > 0 ? (weightedSum / totalRatings).toFixed(1) : 0;

    document.getElementById("satisfaction-value").textContent = avgRating;
    const ring = document.querySelector(".ring-fill");
    if (ring) {
      ring.style.strokeDasharray = `${(avgRating / 5) * 100}, 100`;
    }

    // Update rating breakdown
    Object.entries(ratings).forEach(([r, c]) => {
      const el = document.getElementById(`rating-${r}`);
      if (el) el.textContent = c;
    });

    // Update activity log
    const activityLog = document.getElementById("activity-log");
    if (activityLog) {
      if (state.metrics.activityLog.length === 0) {
        activityLog.innerHTML =
          '<li class="activity-empty">No activity recorded yet</li>';
      } else {
        activityLog.innerHTML = state.metrics.activityLog
          .slice(-10)
          .reverse()
          .map(
            (log) => `
                    <li class="activity-item">
                        <span class="activity-time">${new Date(log.time).toLocaleTimeString()}</span>
                        <span class="activity-type">${log.type}</span>
                        <span class="activity-desc">${log.description}</span>
                    </li>
                `,
          )
          .join("");
      }
    }
  }

  function logActivity(type, description) {
    state.metrics.activityLog.push({
      time: new Date().toISOString(),
      type,
      description,
    });

    // Keep only last 100 entries
    if (state.metrics.activityLog.length > 100) {
      state.metrics.activityLog = state.metrics.activityLog.slice(-100);
    }

    saveMetrics();
    updateMetricsDisplay();
  }

  function saveMetrics() {
    localStorage.setItem("mn_metrics", JSON.stringify(state.metrics));
  }

  function handleSurveySubmit() {
    const comments = document.getElementById("survey-comments")?.value || "";
    state.surveyData.comments = comments;

    // Validate
    if (!state.surveyData.found || state.surveyData.rating === 0) {
      showToast("Please complete all required fields", "error");
      return;
    }

    // Save survey
    state.metrics.surveys.push({
      ...state.surveyData,
      timestamp: new Date().toISOString(),
    });

    // Update ratings
    state.metrics.ratings[state.surveyData.rating]++;

    // Calculate tickets prevented
    if (state.surveyData.support === "definitely") {
      state.metrics.ticketsPrevented++;
    } else if (state.surveyData.support === "maybe") {
      state.metrics.ticketsPrevented += 0.5;
    }

    saveMetrics();
    updateMetricsDisplay();

    showToast("Thank you for your feedback!", "success");
    closeModal("survey-modal");

    // Reset survey data
    state.surveyData = { found: null, rating: 0, support: null, comments: "" };
    document
      .querySelectorAll(".survey-option")
      .forEach((btn) => btn.classList.remove("selected"));
    updateStarDisplay(0);
    if (document.getElementById("survey-comments")) {
      document.getElementById("survey-comments").value = "";
    }
  }

  function exportMetricsCSV() {
    const headers = ["Metric", "Value"];
    const rows = [
      ["Total Queries", state.metrics.totalQueries],
      ["Resolved Queries", state.metrics.resolvedQueries],
      ["Tickets Prevented", state.metrics.ticketsPrevented],
      ["Safety Queries", state.metrics.categoryStats.safety],
      ["Parts Queries", state.metrics.categoryStats.parts],
      ["Warranty Queries", state.metrics.categoryStats.warranty],
      ["Procedure Queries", state.metrics.categoryStats.procedures],
      ["Error Queries", state.metrics.categoryStats.errors],
    ];

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    downloadFile(csv, "metrics.csv", "text/csv");
    showToast("Metrics exported to CSV", "success");
  }

  function exportMetricsJSON() {
    const json = JSON.stringify(state.metrics, null, 2);
    downloadFile(json, "metrics.json", "application/json");
    showToast("Metrics exported to JSON", "success");
  }

  function resetAllMetrics() {
    if (
      !confirm(
        "Are you sure you want to reset all metrics? This cannot be undone.",
      )
    )
      return;

    state.metrics = {
      totalQueries: 0,
      resolvedQueries: 0,
      ticketsPrevented: 0,
      categoryStats: {
        safety: 0,
        parts: 0,
        warranty: 0,
        procedures: 0,
        errors: 0,
        video: 0,
      },
      ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      activityLog: [],
      surveys: [],
    };

    saveMetrics();
    updateMetricsDisplay();
    showToast("Metrics reset successfully", "success");
  }

  // --- Manual Library ---
  function renderManualLibrary() {
    const list = document.getElementById("library-list");
    const count = document.getElementById("manual-count");

    if (!list) return;

    count.textContent = `${state.manualLibrary.length} Manuals`;

    if (state.manualLibrary.length === 0) {
      list.innerHTML = '<div class="library-empty">No manuals loaded</div>';
      return;
    }

    list.innerHTML = state.manualLibrary
      .map(
        (manual) => `
            <div class="library-item ${manual.id === state.currentManualId ? "active" : ""}" data-id="${manual.id}">
                <div class="library-item-info">
                    <span class="library-item-name">${manual.name}</span>
                    <span class="library-item-meta">${manual.pageCount} pages</span>
                </div>
                <div class="library-item-actions">
                    <button class="library-load" onclick="loadManual('${manual.id}')" title="Load">
                        <i class="fa-solid fa-folder-open"></i>
                    </button>
                    <button class="library-delete" onclick="deleteManual('${manual.id}')" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `,
      )
      .join("");
  }

  window.loadManual = function (id) {
    const manual = state.manualLibrary.find((m) => m.id === id);
    if (!manual) return;

    state.currentManualId = id;
    state.pdfPages = manual.pages;
    state.knowledgeBuckets = {};

    // Rebuild gallery
    galleryGrid.innerHTML = "";
    manual.pages.forEach((page) => {
      addVisualToGallery(
        page.pageNum,
        page.imageSrc,
        page.text.substring(0, 50),
      );
    });

    document.getElementById("page-count").textContent =
      `${manual.pageCount} Pages`;
    document.getElementById("file-name").textContent = manual.name;

    // Re-extract knowledge
    extractKnowledge(state.pdfPages);
    updateAnnotationPageSelect();
    renderManualLibrary();

    showToast(`Loaded: ${manual.name}`, "success");
  };

  window.deleteManual = function (id) {
    if (!confirm("Delete this manual from library?")) return;

    state.manualLibrary = state.manualLibrary.filter((m) => m.id !== id);
    localStorage.setItem(
      "mn_manual_library",
      JSON.stringify(state.manualLibrary),
    );

    if (state.currentManualId === id) {
      state.currentManualId = null;
      state.pdfPages = [];
      state.knowledgeBuckets = {};
      galleryGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-images" style="font-size: 2rem; opacity: 0.5;"></i>
                    <p>Upload a manual to see visuals</p>
                </div>`;
      document.getElementById("page-count").textContent = "0 Pages";
    }

    renderManualLibrary();
    showToast("Manual deleted", "success");
  };

  // --- Cross-Manual Search ---
  async function performCrossManualSearch(query) {
    const resultsDiv = document.getElementById("cross-search-results");
    if (!query.trim()) {
      resultsDiv.innerHTML =
        '<div class="empty-state"><p>Enter a search term</p></div>';
      return;
    }

    resultsDiv.innerHTML = `
            <div class="search-loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>Searching across ${state.manualLibrary.length} manuals...</p>
            </div>`;

    const results = [];
    const lowerQuery = query.toLowerCase();

    state.manualLibrary.forEach((manual) => {
      manual.pages.forEach((page) => {
        if (page.text.toLowerCase().includes(lowerQuery)) {
          const idx = page.text.toLowerCase().indexOf(lowerQuery);
          const snippet = page.text.substring(Math.max(0, idx - 50), idx + 100);
          results.push({
            manualId: manual.id,
            manualName: manual.name,
            pageNum: page.pageNum,
            snippet: "..." + snippet + "...",
            imageSrc: page.imageSrc,
          });
        }
      });
    });

    if (results.length === 0) {
      resultsDiv.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-search"></i>
                    <p>No results found for "${query}"</p>
                </div>`;
      return;
    }

    resultsDiv.innerHTML = `
            <div class="search-results-header">Found ${results.length} results</div>
            <div class="search-results-list">
                ${results
        .slice(0, 20)
        .map(
          (r) => `
                    <div class="search-result-item" onclick="loadManualAndGoToPage('${r.manualId}', ${r.pageNum})">
                        <div class="result-thumb">
                            <img src="${r.imageSrc}" alt="Page ${r.pageNum}">
                        </div>
                        <div class="result-info">
                            <span class="result-manual">${r.manualName}</span>
                            <span class="result-page">Page ${r.pageNum}</span>
                            <p class="result-snippet">${r.snippet.replace(new RegExp(query, "gi"), "<mark>$&</mark>")}</p>
                        </div>
                    </div>
                `,
        )
        .join("")}
            </div>`;

    logActivity("cross_search", `"${query}" - ${results.length} results`);
  }

  window.loadManualAndGoToPage = function (manualId, pageNum) {
    window.loadManual(manualId);
    closeModal("cross-search-modal");

    setTimeout(() => {
      const pageData = state.pdfPages.find((p) => p.pageNum === pageNum);
      if (pageData) {
        openImageModal(pageData.imageSrc, pageNum);
      }
    }, 500);
  };

  // --- Image Modal ---
  function openImageModal(src, pageNum) {
    const modal = document.getElementById("image-modal");
    const modalImg = document.getElementById("modal-image");
    modalImg.src = src;
    modalImg.dataset.page = pageNum;
    modal.classList.add("active");
  }

  function identifyPartsInImage() {
    const modalImg = document.getElementById("modal-image");
    const pageNum = parseInt(modalImg.dataset.page);

    closeModal("image-modal");
    switchTab("annotate");

    const select = document.getElementById("annotate-page-select");
    if (select) {
      select.value = pageNum;
      loadPageForAnnotation(pageNum);
    }

    selectAnnotationTool("marker");
    showToast("Click on parts to identify them", "info");
  }

  // --- Slide Panel Navigation ---
  function openSlidePanel(panelId) {
    // Close any open panels first
    document.querySelectorAll(".slide-panel.active").forEach((p) => {
      p.classList.remove("active");
    });
    document.querySelectorAll(".nav-item.active").forEach((n) => {
      n.classList.remove("active");
    });

    // Open the selected panel
    const panel = document.getElementById(`panel-${panelId}`);
    const navItem = document.querySelector(
      `.nav-item[data-panel="${panelId}"]`,
    );

    if (panel) panel.classList.add("active");
    if (navItem) navItem.classList.add("active");
  }

  function closeSlidePanel(panelId) {
    const panel = document.getElementById(`panel-${panelId}`);
    const navItem = document.querySelector(
      `.nav-item[data-panel="${panelId}"]`,
    );

    if (panel) panel.classList.remove("active");
    if (navItem) navItem.classList.remove("active");
  }

  // Legacy switchTab for compatibility
  function switchTab(tabId) {
    openSlidePanel(tabId);
  }

  // --- Modal Helpers ---
  function openModal(id) {
    document.getElementById(id)?.classList.add("active");
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.remove("active");
  }

  // --- Toast Notifications ---
  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icon =
      {
        success: "fa-check-circle",
        error: "fa-exclamation-circle",
        info: "fa-info-circle",
        warning: "fa-triangle-exclamation",
      }[type] || "fa-info-circle";

    toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `;

    container.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // --- Download Helper ---
  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  // --- API Calls ---
  async function callScaleDown(context, prompt, model = "gpt-4o", rate = 0.4) {
    const apiKey = state.scaledownKey;
    if (!apiKey) {
      return "Summarization unavailable";
    }

    try {
      const res = await fetch("https://api.scaledown.xyz/compress/raw/", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context: context,
          prompt: prompt,
          model: model,
          scaledown: { rate: rate },
        }),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403)
          return "Invalid ScaleDown Key";
        throw new Error(`ScaleDown API Error: ${res.status}`);
      }

      const data = await res.json();

      console.log("ScaleDown API Response:", JSON.stringify(data, null, 2));

      if (data.results?.compressed_prompt)
        return data.results.compressed_prompt;
      if (data.compressed_prompt) return data.compressed_prompt;

      console.warn("ScaleDown: No compressed_prompt in response", data);
      return "No relevant summary found.";
    } catch (error) {
      console.error("ScaleDown Call Failed:", error);
      return "ScaleDown Connection Failed";
    }
  }

  async function callGemini(prompt, imageData = null) {
    if (!state.geminiKey) return "Please configure API Keys.";

    let finalPrompt = prompt;

    try {
      const modelToUse = state.geminiModel || "gemini-2.0-flash";

      // Build parts array - text and optionally image
      const parts = [{ text: finalPrompt }];
      if (imageData) {
        parts.push({
          inline_data: {
            mime_type: imageData.mimeType,
            data: imageData.base64,
          },
        });
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${state.geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: parts }],
          }),
        },
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          `Gemini API Error: ${errorData.error?.message || res.statusText}`,
        );
      }

      const data = await res.json();

      if (!data.candidates?.[0]?.content?.parts?.[0]) {
        throw new Error("Invalid API response structure");
      }

      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error("Gemini API call failed:", error);
      throw error;
    }
  }

  // Gemini call that forces valid JSON output via responseMimeType
  async function callGeminiJSON(prompt) {
    if (!state.geminiKey) throw new Error("Please configure API Keys.");

    const modelToUse = state.geminiModel || "gemini-2.0-flash";
    const parts = [{ text: prompt }];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${state.geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: parts }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(
        `Gemini API Error: ${errorData.error?.message || res.statusText}`,
      );
    }

    const data = await res.json();

    if (!data.candidates?.[0]?.content?.parts?.[0]) {
      throw new Error("Invalid API response structure");
    }

    const text = data.candidates[0].content.parts[0].text;
    return JSON.parse(text);
  }
});
