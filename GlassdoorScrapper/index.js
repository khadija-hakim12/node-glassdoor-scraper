const puppeteer  = require("puppeteer");
const chalk = require("chalk");
const cheerio = require('cheerio');
const { GLASSDOOR_URL_MAIN  , GLASSDOOR_SELECTOR_GOTO_ALL_JOBS , GLASSDOOR_SELECTOR_MODAL} = require("./constants");



// Class Scrapper
// This class provides a web scraping function that logs into Glassdoor with provided user credentials and searches for jobs based on a job title and location. It uses Puppeteer to navigate and scrape data from the website.
class Scrapper{
   // Constructor for Scrapper Class. Takes email and password for Glassdoor account as arguments.
    constructor (email , password){
        this.email = email;
        this.password = password;
        this.page = undefined;
        this.browser = undefined;
        this.jobs = [];
    }
// Get all Jobs Getter
    get allJobs(){
        return this.jobs
      }

   async login(){
         this.browser = await puppeteer.launch({
            headless:false
        });
        
        this.page = await this.browser.newPage();
        await this.page.goto(GLASSDOOR_URL_MAIN);
        await this.page.waitForSelector('input[type=email]');

         await this.page.type('input[type=email]', this.email );
         await this.page.$eval( 'button[type=submit]', form => form.click() );
         await this.page.waitForSelector('input[type=password]');
         await this.page.type('input[type=password]', this.password);
         await this.page.$eval( 'button[type=submit]', form => form.click() );

        await this.page.waitForNavigation({timeout:50000})
        console.log(chalk.green(
            'User Autheticated ' +
            chalk.blue.underline.bold('Going To Home Page') +
            ' Ready to fetch Jobs'
        ));
    }

   async navigateToSeachBar(){       
        await this.page.$$eval('button[type=button]', (buttons)=>{
            buttons[3].click()
        });
        await this.page.waitForSelector('input[id=scKeyword]')
        this.page = this.page
        console.log(chalk.green(
            'Moved To Search Page'
        ));
    }

    async run(jobTitle , country , fn = ()=>{}){
        console.log(chalk.green('Started Fetching Jobs'))

        await this.page.goto(`https://www.glassdoor.com/Search/results.htm?keyword=${jobTitle}&locT=S&locName=${country}`)
       
        await this.page.$eval(GLASSDOOR_SELECTOR_GOTO_ALL_JOBS,(link)=>{link.click()})
        await this.page.evaluate(()=>{document.location.reload()})
        await this.page.waitForNavigation()

        await this.page.$eval(GLASSDOOR_SELECTOR_MODAL , (closeButton)=>{
            closeButton.click()
        })
        
        const totalNumberOfPages = await this.page.$eval('.paginationFooter',(element)=>element.innerText.split("of")[1])
        for (let i=1;i<=totalNumberOfPages;i++){
            if(i===1){
               let jobInsideNodeScope =  await this.__extractDataFromJobList()
               this.jobs = [ ...jobInsideNodeScope ,...this.jobs ] 

            }
            else{
                await this.page.$eval('button.nextButton' , (nextButton)=>{
                    nextButton.click()
                })
                await this.page.waitForNavigation()

               let jobInsideNodeScope =  await this.__extractDataFromJobList()
               this.jobs = [ ...jobInsideNodeScope ,...this.jobs ] 
            }
        }
        // Close The Browser
        this.browser.close()
        console.log(chalk.green(
            'Jobs Has Been Fetched ' +
            `${this.jobs.length} Jobs Fetched`
        ));
         return fn(this.jobs)
        

    }
    async findLinkedInDecisonMakers(cookie, keyword = "CEO") {
        console.log(chalk.green(
            'Start Fetching Decision Makers On LinkedIn ' 
        ));
        let jobsIteration=0;
        while (jobsIteration != this.jobs.length - 1) {
            try {
                // Search company on LinkedIn
                
                 this.page = await this.browser.newPage();
                const cookies = { name: 'li_at', value: cookie, domain: '.www.linkedin.com' };
                const companyLink = await this._fetchCompanyLink(this.jobs[jobsIteration].companyName, cookie); // on wait keyword VS code has claim but await need to be there
                await this.page.setCookie(cookies);
                await this.page.goto(companyLink + 'people/?keywords=' + keyword);
            
                // Extract links and names
                const html = await this.page.$eval('.display-flex.list-style-none.flex-wrap', el => el.innerHTML);
                const $ = cheerio.load(html);
                const links = $('li > div > section > img + div > div > div + div > div > a')
                  .map((i, el) => $(el).attr('href'))
                  .get()
                  .filter(link => link !== undefined);
                const names = $('li > div > section > img + div > div > div + div > div > a > div')
                  .map((i, el) => $(el).text())
                  .get()
                  .filter(name => name !== undefined);
            this.jobs[jobsIteration].companyDecisionMakers = {
                links,
                names
            }
                await browser.close();
                
                jobsIteration++
               
              } catch (error) {
                this.jobs[jobsIteration].companyDecisionMakers = {
                    links:"Not Found",
                    names:"Not Found"
                }
                jobsIteration++
                throw new Error(`Unable to fetch company decision makers: ${error}`);
                
              }
        }
        console.log(chalk.green(
            'Fetched Decision Makers On LinkedIn ' 
        ));
       
      };

  

    async _fetchCompanyLink(companyName, cookie) {
        try {
           this.page = await browser.newPage();
          const cookies = { name: 'li_at', value: cookie, domain: '.www.linkedin.com' };
          await this.page.setCookie(cookies);
          await this.page.goto(`https://www.linkedin.com/search/results/companies/?keywords=${companyName}`);
          const html = await this.page.$eval('.reusable-search__entity-result-list.list-style-none', el => el.innerHTML);
          const $ = cheerio.load(html);
          const companyCode = $('li > div').attr('data-chameleon-result-urn').split(':')[3];
          await browser.close();
          return `https://www.linkedin.com/company/${companyCode}/`;
        } catch (error) {
          throw new Error(`Unable to fetch company link: ${error.message}`);
        }
      }

// internal function
     async __extractDataFromJobList(){
       return await this.page.$$eval("article#MainCol > div >  div + ul >li",(li)=>{
            let job = []
             li.forEach((li)=>{
                    let listItem = li.childNodes[1]
                    job.push({
                    companyName:listItem.childNodes[0].childNodes[0].childNodes[0].innerText, // Reading the Company Name
                    jobLink:"https://www.glassdoor.com"+listItem.childNodes[0].childNodes[0].getAttribute('href'),  // Reading the Job url
                    source:"glassDoor"  // Adding this incase we have to filter jobs by the site
                    })
                })
                return job;
            })

      }
}

module.exports = Scrapper




   