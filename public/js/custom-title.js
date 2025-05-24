document.addEventListener('DOMContentLoaded', function() {
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            const titleElement = document.querySelector('.navbar-brand');
            if (titleElement) {
                titleElement.textContent = `>${data.ip}@crashlogs:~$`;
            }
        })
        .catch(error => console.error('Error fetching IP:', error));
});