const fs = require('fs');
const pdf = require('pdf-parse');

const filePath = 'C:\\Users\\priya\\Downloads\\Diwali Dealer price bulk.pdf';
let dataBuffer = fs.readFileSync(filePath);

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('pdf_output.txt', data.text, 'utf8');
}).catch(function(error){
    console.error(error);
});
