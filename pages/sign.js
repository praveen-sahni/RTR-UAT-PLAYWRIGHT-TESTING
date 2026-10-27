export class SigninPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // Splash Card Locators
    this.splashHeading = page.getByRole("heading", {
      name: /Build the Retirement You Deserve/i,
    });
    this.signInSplashBtn = page.getByRole("button", {
      name: "Sign In",
      exact: true,
    });
    this.cardBackBtn = page.getByRole("button").first();
    this.createAccountSplashBtn = page.getByRole("button", {
      name: "Create Free Account",
    });
    this.termsLink = page.getByText("Terms of Service");
    this.privacyLink = page.getByText("Privacy Policy");

    // Auth Card Locators (Login / Register)
    this.authHeading = page.getByRole("heading", {
      name: /(Welcome back|Create your account)/i,
    });
    this.mobileInput = page.getByPlaceholder("Enter 10-digit number");
    this.agreementCheckbox = page.locator("button").nth(1);
    this.sendOtpBtn = page.getByRole("button", { name: "Send OTP" });
    this.toggleModeBtn = page.getByRole("button", {
      name: /(Sign in|Create account)/i,
    });

    // OTP Card Locators
    this.otpHeading = page.getByRole("heading", {
      name: /Verify your number/i,
    });
    this.otpInputs = page.locator('input[type="tel"]'); // Grabs all 6 OTP boxes
    this.verifyOtpBtn = page.getByRole("button", { name: "Verify OTP" });
    this.resendOtpText = page.getByText(/Resend OTP in/i);
    this.resendOtpLink = page.getByRole("button", { name: "Resend OTP" });

    // MPIN Verify Card Locators
    this.mpinVerifyHeading = page.getByRole("heading", {
      name: /Welcome back!|Hi,/i,
    });
    this.mpinInputs = page.locator('input[type="password"]'); // Grabs all 4 MPIN boxes
    this.verifyMpinBtn = page.getByRole("button", { name: "Verify MPIN" });

    // MPIN Setup Card Locators
    this.mpinSetupHeading = page.getByRole("heading", {
      name: /(Create Your MPIN|Confirm Your MPIN)/i,
    });
    this.setMpinBtn = page.getByRole("button", { name: "Set MPIN" });

    // Global UI Elements
    this.toastMessage = page.locator('.Toastify__toast-body, [role="alert"]');
    this.inlineError = page.locator("p").filter({
      hasText:
        /(Invalid OTP|Incorrect MPIN|PINs do not match|Mobile number not registered)/i,
    });
    this.spinner = page
      .locator("svg")
      .filter({ has: page.locator("circle") })
      .last();
  }

  async goto() {
    await this.page.goto("/signin");
  }

  /**
   * Types the mobile number digit by digit to trigger React's onChange.
   * Does NOT click "Send OTP" as the 10th digit auto-submits after 200ms.
   */
  async enterMobile(number) {
    await this.mobileInput.click();
    await this.mobileInput.pressSequentially(number, { delay: 150 });
  }

  async toggleAgreement() {
    await this.agreementCheckbox.click();
  }

  /**
   * Fills the OTP boxes. Entering the 6th digit auto-submits.
   */
  async enterOtp(otpString) {
    await this.otpInputs.first().waitFor({ state: "visible" });
    for (let i = 0; i < otpString.length; i++) {
      await this.otpInputs
        .nth(i)
        .pressSequentially(otpString[i], { delay: 100 });
      await this.page.waitForTimeout(150);
    }
  }

  /**
   * Fills the MPIN boxes. Entering the 4th digit auto-submits.
   */
  async enterMpin(mpinString) {
    const count = await this.mpinInputs.count();
    if (count > 1) {
      for (let i = 0; i < mpinString.length; i++) {
        await this.mpinInputs
          .nth(i)
          .pressSequentially(mpinString[i], { delay: 100 });
        await this.page.waitForTimeout(150);
      }
    } else {
      await this.mpinInputs
        .first()
        .pressSequentially(mpinString, { delay: 150 });
    }
  }
}