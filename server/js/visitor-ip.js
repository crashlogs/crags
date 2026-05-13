async function getVisitorIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        const titleElement = document.getElementById('site-title');
        if (titleElement) {
            const baseTitle = titleElement.getAttribute('data-base-title');
            titleElement.textContent = `>Visitor ${data.ip} @${baseTitle}`;
        }
    } catch (error) {
        console.error('Error fetching IP:', error);
    }
}

// Call when DOM is loaded
document.addEventListener('DOMContentLoaded', getVisitorIP);