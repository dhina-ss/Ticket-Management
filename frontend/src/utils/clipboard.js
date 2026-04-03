/**
 * Copy text to clipboard with a fallback for non-secure contexts (HTTP).
 * navigator.clipboard requires HTTPS or localhost.
 * @param {string} text The text to copy.
 * @returns {Promise<boolean>} Resolves to true if successful, false otherwise.
 */
export const copyToClipboard = async (text) => {
    // Try modern API first
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error("navigator.clipboard.writeText failed:", err);
        }
    }

    // Fallback for non-secure contexts or failed modern API
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Ensure textarea is not visible but part of the DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            return true;
        }
    } catch (err) {
        console.error("Fallback copy failed:", err);
    }

    return false;
};
