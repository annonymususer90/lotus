const constants = require('./constants');
const { infoAsync, errorAsync } = require('./apputils');

const isLogin = async (loginCache, url) => {

    if (loginCache.get(url) === undefined) {
        return false;
    }

    const pageUrl = await loginCache.get(url).page.url();
    if (pageUrl.includes(url)) {
        try {
            await loginCache.get(url).page.waitForXPath("/html/body/div/div/ng-include/div/section/form", { timeout: 3000 });
            return false;
        } catch (ex) {
        }
    }

    return true;
}

const getResponseMessage = async (page) => {
    const element = await page.waitForSelector('div.content.-notices > p');
    const message = await page.evaluate(ele => ele.textContent, element);

    if (message.includes('Sorry'))
        return { success: false, message: message.trim() };
    return { success: true, message: message.trim() };
}

const goToMemberListing = async (page) => {
    await page.evaluate(`
            var leftPane = document.querySelector('.left-pane');
            leftPane.children[0].children[0].children[0].children[0].click();
            leftPane.children[0].children[0].children[0].children[1].children[0].children[0].click();
        `);
}

const searchUser = async (page, username) => {
    await page.waitForFunction(`!!document.querySelector('#username')`);
    // await page.waitForSelector('#username', { timeout: 120000 });
    await page.type('#username', username);
    await page.waitForFunction(`!!document.querySelector('div.search-dropdown > ul > li:nth-child(1)')`, { timeout: 90000 });
    await page.keyboard.press('Enter');

    await page.waitForSelector('table > tbody > tr:nth-child(2) > td > a', { timeout: 120000 });
    const element = await page.$('table > tbody > tr:nth-child(2) > td > a');
    let value = await page.evaluate(ele => ele.textContent, element);
    if (value !== username)
        throw new Error('invalid username!');
}

async function login(page, url, username, password) {
    await page.goto(url, { timeout: 90000 });
    await page.waitForXPath('/html/body/div/div/ng-include/div/section/form', { timeout: 10000 });
    await page.type('#username', username);
    await page.type('#password', password);
    await page.click('#submit');
    await page.waitForNavigation({ timeout: 90000 });
    infoAsync(`login successful, url: ${url}`);
}

async function register(page, username) {

    try {
        await goToMemberListing(page);

        await page.waitForSelector('#createAgent')
            .then(ele => ele.click());
        await page.waitForSelector('form > section:nth-child(1) > div > div > div:nth-child(2) > span > input')
            .then(ele => ele.type(username));
        await page.waitForSelector('form > section:nth-child(1) > div > div > div:nth-child(3) > input')
            .then(ele => ele.type(constants.DEFAULT_PASSWORD));
        await page.waitForSelector('form > section:nth-child(1) > div > div > div:nth-child(4) > input')
            .then(ele => ele.type(constants.DEFAULT_PASSWORD));
        await page.waitForSelector('form > section:nth-child(2) > div > div > div > div:nth-child(1) > div > input')
            .then(ele => ele.type('0'));
        await page.waitForSelector('table > tbody > tr:nth-child(2) > td > span > span > input')
            .then(ele => ele.type('0'));
        await page.waitForSelector('button[type="submit"]')
            .then(ele => ele.click());

        return await getResponseMessage(page);
    } catch (error) {
        errorAsync(error.message);
        return { success: false, error: "invalid username" };
    }
}

async function changePass(page, username, pass) {
    try {
        await goToMemberListing(page);
        await searchUser(page, username);
        await page.waitForFunction(() => !!document.querySelector('table > tbody > tr:nth-child(2) > td > a'));
        await page.evaluate(`document.querySelector('table > tbody > tr:nth-child(2) > td > a').click()`, { timeout: 120000 });

        await page.waitForFunction('!!document.querySelector("form")', { timeout: 90000 });
        await page.type('form > section:nth-child(1) > div > div > div:nth-child(3) > input', pass);
        await page.type('form > section:nth-child(1) > div > div > div:nth-child(4) > input', pass);
        await page.keyboard.press('Enter');

        return await getResponseMessage(page);
    } catch (error) {
        errorAsync(error.message);
        return { success: false, error: error.message };
    }
}

async function lockUser(page, username) {
    try {
        await goToMemberListing(page);
        await searchUser(page, username);

        await page.waitForFunction(() => !!document.querySelector('table > tbody > tr:nth-child(2) > td > a'));
        await page.evaluate(`document.querySelector('table > tbody > tr:nth-child(2) > td > a').click()`, { timeout: 120000 });

        await page.waitForFunction('!!document.querySelector("form")', { timeout: 90000 });

        await page.click('form > section:nth-child(1) > div > div > div:nth-child(5) > label:nth-child(3) > input');
        await page.keyboard.press('Enter');

        return await getResponseMessage(page);
    } catch (error) {
        errorAsync(error.message);
        return { success: false, error: error.message };
    }
}

async function deposit(page, username, amount) {
    try {
        await goToMemberListing(page);
        await searchUser(page, username);

        await page.waitForFunction(() => !!document.querySelector('table > tbody > tr:nth-child(2) > td > a'));
        await page.evaluate(`document.querySelector('table > tbody > tr:nth-child(2) > td > a').click()`, { timeout: 120000 });

        await page.waitForFunction('!!document.querySelector("form")', { timeout: 90000 });

        await page.waitForFunction(`!!document.querySelector('form > section:nth-child(2) > div > div > div > div:nth-child(1) input')`);
        let availableCredit = await page.evaluate(`document.querySelector('form > section:nth-child(2) > div > div > div > div:nth-child(1) input').value`, { timeout: 120000 });
        amount = parseInt(availableCredit) + parseInt(amount);
        await page.evaluate(`document.querySelector('form > section:nth-child(2) > div > div > div > div:nth-child(1) input').focus()`);

        for (let i = 0; i < availableCredit.length; i++)
            await page.keyboard.press('Backspace');

        await page.keyboard.type(amount.toString(), { delay: 100 });

        await page.$eval('button[type="submit"]', async (ele) => await ele.click());

        let result = await getResponseMessage(page);
        return result;
    } catch (error) {
        errorAsync(error.message);
        return { success: false, error: error.message };
    }
}

async function withdraw(page, username, amount) {
    try {
        await goToMemberListing(page);
        await searchUser(page, username);
        await page.waitForFunction(() => !!document.querySelector('table > tbody > tr:nth-child(2) > td > a'));
        await page.evaluate(`document.querySelector('table > tbody > tr:nth-child(2) > td > a').click()`, { timeout: 120000 });

        await page.waitForFunction('!!document.querySelector("form")', { timeout: 90000 });

        await page.waitForFunction(`!!document.querySelector('form > section:nth-child(2) > div > div > div > div:nth-child(1) input')`);
        let availableCredit = await page.evaluate(`document.querySelector('form > section:nth-child(2) > div > div > div > div:nth-child(1) input').value`, { timeout: 120000 });
        amount = parseInt(availableCredit) - parseInt(amount);
        await page.evaluate(`document.querySelector('form > section:nth-child(2) > div > div > div > div:nth-child(1) input').focus()`);

        for (let i = 0; i < availableCredit.length; i++)
            await page.keyboard.press('Backspace');

        await page.keyboard.type(amount.toString(), { delay: 100 });

        await page.$eval('button[type="submit"]', async (ele) => await ele.click());

        let result = await getResponseMessage(page);
        return result;
    } catch (error) {
        errorAsync(error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    isLogin: isLogin,
    login: login,
    register: register,
    lockUser: lockUser,
    deposit: deposit,
    withdraw: withdraw,
    changePass: changePass
}
