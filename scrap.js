
const puppeteer = require('puppeteer-extra')
const cron = require('node-cron')

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin())

async function getInvoices() {
    try {

        const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
        const page = await browser.newPage();
        page.on('dialog', dialog => {
            dialog.dismiss()
        })

        await page.goto('https://erp.tiny.com.br/')

        await page.locator('input[name=username]').fill(process.env.USERNAME)
        await page.locator('input[name=password]').fill(process.env.PASSWORD);
        await page.locator('html > body > div > div:nth-of-type(2) > div > div > react-login > div > div > div:first-of-type > div:first-of-type > div:first-of-type > form > div:nth-of-type(3) > button').click()

        try { 
            await page.locator('#bs-modal-ui-popup > div > div > div > div.modal-footer > button.btn.btn-primary').click() 
            const test = await page.waitForNavigation({
                waitUntil: 'networkidle0'
            })
        } catch (e) {
            console.log(e)
            console.log('error')
        }

        await page.locator('#widgets-home > div > div:nth-child(1) > div.banner-olist-tiny > div > div.left > span > img')
        await page.goto('https://erp.tiny.com.br/notas_fiscais#list');

        await page.locator('#page-wrapper > div.panel.panel-list > div.panel-head.page-head > div.top-bar > div > a').wait()

        await page.locator('#sit-P').click();

        await page.locator('tr[idnota]').wait()

        const tableData = await page.$$eval('tr[idnota]', (rows, atr) => {
            return rows.map(row => {
                let storeData = row.querySelector('.badge-ecommerce > img')
                let invoiceId = row.getAttribute(atr)

                if (storeData) {
                    return { id: invoiceId, store: storeData.getAttribute('alt')}
                }

                return { id: invoiceId, store: '' }
            });
        }, 'idnota');
        
        await browser.close()
        return await tableData
    } catch (e) {
        throw new Error(e)
    }

}

const storeEnum = {
    'Shopee': 'shopee',
    'Shein': 'shein',
    'Mercado Livre': 'mercado',
    'Aliexpress': 'aliexpress',
}


async function sendInvoices(invoices) {
    console.log('starting sending invoices')
    for (const invoice of invoices) {
        await fetch(`${process.env.API_URL}${invoice.id}&store=${storeEnum[invoice.store]}`)
            .then((res) => {
                console.log('Invoice: ', invoice, 'Status: ', res.status)
            })
            .catch((err) => {
                throw new Error('Error on invoice ' + err)
            })
    }
    console.log('finished sending invoices, waiting for routine')
}

async function scrapRoutine() {
    let attempts = 1
    for (let i = 0; i <= attempts; i++) {
        try {
            let invoices = await getInvoices();
            console.log(invoices);
            if (invoices.length > 1) {
                try {
                    await sendInvoices(invoices)
                    attempts = 0
                } catch (e) {
                    console.log('error', e)
                    throw new Error('Fail to send invoices')
                }
            }
        } catch (e) {
            console.error('Failed to start routine ', e, e.message)
        }
    }
}

async function main() {
    console.log('starting routine...')
    await scrapRoutine();
    cron.schedule(`*/${process.env.CRON}`, async () => {
        await scrapRoutine();
    })

}

(async () => {
    await main();
})();
