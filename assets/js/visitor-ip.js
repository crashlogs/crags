async function getVisitorIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        console.log('IP fetched:', data.ip); // Debug log
        
        // Get all elements that need the IP update
        const titleElements = document.querySelectorAll('.site-name a');
        titleElements.forEach(element => {
            element.textContent = `>Visitor ${data.ip} @crashlogs`;
        });
    } catch (error) {
        console.error('Error fetching IP:', error);
    }
}

// Call when DOM is loaded
document.addEventListener('DOMContentLoaded', getVisitorIP);