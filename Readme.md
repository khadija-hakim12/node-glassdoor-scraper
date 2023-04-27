## Scraper Class

The `Scraper` class is a web scraper designed to extract job listings from Glassdoor and find LinkedIn decision makers. The class is built using Puppeteer, Cheerio, and Chalk. 

### Usage

The `Scraper` class requires an email and password to log in to Glassdoor. After logging in, the `run()` method can be used to extract job listings based on job title and location. The `findLinkedInDecisionMakers()` method can then be used to find decision makers for each job's company on LinkedIn. 

### Constructor

The `Scraper` class has the following constructor:

```javascript
constructor(email, password)
```

- `email`: Glassdoor account email
- `password`: Glassdoor account password

### Methods

#### `run(jobTitle, country, fn)`

This method extracts job listings from Glassdoor based on the provided job title and country. The method takes in the following parameters:

- `jobTitle`: job title to search for
- `country`: country to search in
- `fn`: an optional callback function to execute after the job listings have been extracted

The method returns a Promise that resolves to an array of job listing objects with the following properties:

- `title`: job title
- `companyName`: name of the company offering the job
- `location`: job location
- `description`: job description
- `url`: URL of the job listing on Glassdoor
- `companyDecisionMakers`: an object containing the decision makers for the company offering the job (set to "Not Found" if not found)

#### `findLinkedInDecisionMakers(cookie, keyword)`

This method finds the decision makers for each job's company on LinkedIn. The method takes in the following parameters:

- `cookie`: LinkedIn authentication cookie
- `keyword`: keyword to search for on LinkedIn (defaults to "CEO")

The method updates the `companyDecisionMakers` property of each job listing object.

### Example

```javascript
const Scraper = require('./scraper');

const email = 'your-email@example.com';
const password = 'your-password';
const cookie = 'your-linkedin-cookie';

const scraper = new Scraper(email, password);
await scraper.login();
await scraper.navigateToSeachBar();
await scraper.run('software engineer', 'United States');
await scraper.findLinkedInDecisionMakers(cookie);
console.log(scraper.allJobs);
```