import { test, expect } from "@playwright/test";
import { SigninPage } from "../pages/sign.js";
import authMocks from "../mocks/auth.mocks.json";

test.describe("Authentication & Sign-In Flow", () => {
    let signinPage;

    test.beforeEach(async ({ page }, testInfo) => {
    signinPage = new SigninPage(page);

    // 🏷️ Display live test title badge inside headed browser window
    await page.addInitScript((title) => {
        window.addEventListener("DOMContentLoaded", () => {
        const banner = document.createElement("div");
        banner.id = "playwright-test-banner";
        banner.textContent = `🧪 ${title}`;
        Object.assign(banner.style, {
          position: "fixed",
          top: "12px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#0f172a",
          color: "#38bdf8",
          padding: "6px 16px",
          borderRadius: "20px",
          fontSize: "12px",
          fontWeight: "600",
          fontFamily: "system-ui, sans-serif",
          zIndex: "999999",
          border: "1px solid #38bdf840",
          pointerEvents: "none",
        });
        document.body.appendChild(banner);
      });
    }, testInfo.title);
  });

  // =============================================================
  // SECTION 1: Entry & Screen State
  // =============================================================
  test.describe("1. Entry & Screen State", () => {
    test("Splash navigation behaves correctly", async () => {
      await test.step("1. Open signin page and verify splash screen", async () => {
        await signinPage.goto();
        await expect(signinPage.splashHeading).toBeVisible();
      });

      await test.step("2. Click Sign In and verify Welcome Back heading", async () => {
        await signinPage.signInSplashBtn.click();
        await expect(signinPage.authHeading).toHaveText(/Welcome back/i);
      });

      await test.step("3. Return to splash via card back button", async () => {
        await signinPage.cardBackBtn.click();
        await expect(signinPage.splashHeading).toBeVisible();
      });

      await test.step("4. Click Create Free Account and verify heading", async () => {
        await signinPage.createAccountSplashBtn.click();
        await expect(signinPage.authHeading).toHaveText(/Create your account/i);
      });
    });

    test("Session persistence guard redirects authenticated users", async ({
      page,
    }) => {
      await test.step("1. Pre-seed sessionStorage with active login flag", async () => {
        await page.addInitScript(() => {
          window.sessionStorage.setItem("islogin", "true");
        });
      });

      await test.step("2. Navigate to /signin and assert redirect to /lifegoal", async () => {
        await signinPage.goto();
        await page.waitForURL("/lifegoal/");
        expect(page.url()).toContain("/lifegoal/");
      });
    });

    test("Legal links are present and clickable", async () => {
      await test.step("1. Open signin page", async () => {
        await signinPage.goto();
      });

      await test.step("2. Assert Terms of Service and Privacy Policy links exist", async () => {
        await expect(signinPage.termsLink).toBeVisible();
        await expect(signinPage.privacyLink).toBeVisible();
      });
    });
  });

  // =============================================================
  // SECTION 2: Mobile Input & Boundary Scenarios
  // =============================================================
  test.describe("2. Mobile Input & Boundary Scenarios", () => {
    test.beforeEach(async () => {
      await signinPage.goto();
      await signinPage.signInSplashBtn.click();
    });

    test("Entering fewer than 10 digits keeps button disabled", async () => {
      await test.step("1. Type 5 digits into mobile input", async () => {
        await signinPage.enterMobile("12345");
      });

      await test.step("2. Verify Send OTP button remains disabled", async () => {
        await expect(signinPage.sendOtpBtn).toBeDisabled();
      });
    });

    test("Typing non-numeric characters strips them out immediately", async () => {
      await test.step("1. Type alphanumeric and special characters sequentially", async () => {
        await signinPage.mobileInput.pressSequentially("12abc34!@#");
      });

      await test.step("2. Verify only numeric digits are retained in input", async () => {
        await expect(signinPage.mobileInput).toHaveValue("1234");
      });
    });

    test("Unchecking agreement keeps button disabled on 10 digits", async () => {
      await test.step("1. Uncheck the Terms of Service agreement checkbox", async () => {
        await signinPage.toggleAgreement();
      });

      await test.step("2. Enter valid 10-digit mobile number", async () => {
        await signinPage.enterMobile("8595614105");
      });

      await test.step("3. Verify Send OTP button remains disabled", async () => {
        await expect(signinPage.sendOtpBtn).toBeDisabled();
      });
    });

    test("10th digit auto-submits after 200ms", async ({ page }) => {
      await test.step("1. Wire up mock for customer-login endpoint", async () => {
        await page.route(
          /\/api\/authentication\/customer-login/,
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(authMocks.otpSentSuccess),
            });
          },
        );
      });

      await test.step("2. Enter 10-digit number to trigger auto-submit", async () => {
        await signinPage.enterMobile("8595614105");
      });

      await test.step("3. Verify OTP card mounts automatically without manual click", async () => {
        await expect(signinPage.otpHeading).toBeVisible({ timeout: 10000 });
      });
    });
  });

  // =============================================================
  // SECTION 3: Backend Divergence & Mode Collision
  // =============================================================
  test.describe("3. Backend Divergence & Mode Collision", () => {
    test("Unregistered user login shows error toast", async ({ page }) => {
      await test.step("1. Mock customer-login API with unregistered error", async () => {
        await page.route(
          /\/api\/authentication\/customer-login/,
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(authMocks.unregisteredUser),
            });
          },
        );
      });

      await test.step("2. Navigate to Sign In and enter unregistered mobile", async () => {
        await signinPage.goto();
        await signinPage.signInSplashBtn.click();
        await signinPage.enterMobile("9999900000");
      });

      await test.step("3. Assert red error toast appears on screen", async () => {
        await expect(page.getByText("Mobile number not registered")).toBeVisible(
          { timeout: 10000 },
        );
      });
    });

    test("Duplicate signup prevention shows error toast", async ({ page }) => {
      await test.step("1. Mock registration endpoint with duplicate account error", async () => {
        await page.route(
          /\/api\/authentication\/(mobile-verification|customer-login)/,
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(authMocks.duplicateUser),
            });
          },
        );
      });

      await test.step("2. Navigate to Create Account and enter registered mobile", async () => {
        await signinPage.goto();
        await signinPage.createAccountSplashBtn.click();
        await signinPage.enterMobile("8595614105");
      });

      await test.step("3. Assert error toast prompts user to sign in instead", async () => {
        await expect(
          page.getByText(
            /Account already created\. Please sign into your account\./i,
          ),
        ).toBeVisible({ timeout: 10000 });
      });
    });
  });

  // =============================================================
  // SECTION 4: OTP Screen Mechanics & Timer
  // =============================================================
  test.describe("4. OTP Screen Mechanics & Timer", () => {
    test.beforeEach(async ({ page }) => {
      await page.route(
        /\/api\/authentication\/customer-login/,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(authMocks.otpSentSuccess),
          });
        },
      );

      await signinPage.goto();
      await signinPage.signInSplashBtn.click();
      await signinPage.enterMobile("8595614105");
      await expect(signinPage.otpHeading).toBeVisible();
    });

    test("60-second countdown timer runs and disables resend", async () => {
      await test.step("1. Verify Resend OTP button is hidden or disabled during countdown", async () => {
        await expect(signinPage.resendOtpLink).not.toBeVisible();
      });

      await test.step("2. Verify countdown timer display is ticking", async () => {
        await expect(signinPage.resendOtpText).toHaveText(/\b(57|58|59|60)s\b/);
      });
    });

    test("Keyboard traversal works forward and backward", async ({ page }) => {
      await test.step("1. Click first OTP box and type a single digit", async () => {
        await signinPage.otpInputs.first().click();
        await page.keyboard.type("1");
      });

      await test.step("2. Verify DOM focus shifted automatically to second box", async () => {
        await expect(signinPage.otpInputs.nth(1)).toBeFocused();
      });

      await test.step("3. Press Backspace and verify focus shifts back to first box", async () => {
        await page.keyboard.press("Backspace");
        await expect(signinPage.otpInputs.nth(0)).toBeFocused();
        await expect(signinPage.otpInputs.nth(0)).toHaveValue("");
      });
    });

    test("Clipboard paste fills all boxes and auto-submits", async ({
      page,
    }) => {
      await test.step("1. Intercept OTP verification request with existing user profile", async () => {
        await page.route(
          /\/api\/authentication\/customer-login/,
          async (route) => {
            const payload = route.request().postDataJSON() || {};
            if (payload.otp) {
              await route.fulfill({
                status: 200,
                contentType: "application/json", // fixed typo
                body: JSON.stringify(authMocks.loginSuccessExistingUser),
              });
            } else {
              await route.fallback(); // fall back to earlier mock instead of hitting network
            }
          },
        );
      });

      await test.step("2. Focus first box and paste 6-digit OTP string", async () => {
        await signinPage.otpInputs.first().click();
        await signinPage.otpInputs.first().evaluate((el) => {
          const clipData = new DataTransfer();
          clipData.setData("text/plain", "123456");
          el.dispatchEvent(
            new ClipboardEvent("paste", {
              clipboardData: clipData,
              bubbles: true,
            }),
          );
        });
      });

      await test.step("3. Verify auto-submit triggers and navigates to MPIN card", async () => {
        // FIX: was signinPage.mpinHeading (undefined)
        await expect(signinPage.mpinVerifyHeading).toBeVisible({
          timeout: 10000,
        });
      });
    });
  });

  // =============================================================
  // SECTION 5: Verification, MPIN & Onboarding Progression
  // =============================================================
  test.describe("5. Verification, MPIN & Onboarding Progression", () => {
    test.beforeEach(async () => {
      await signinPage.goto();
      await signinPage.signInSplashBtn.click();
    });

    test("Wrong OTP shows inline error", async ({ page }) => {
      await test.step("1. Setup conditional mock for OTP send & invalid verification", async () => {
        await page.route(
          /\/api\/authentication\/customer-login/,
          async (route) => {
            const payload = route.request().postDataJSON() || {};
            if (!payload.otp) {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(authMocks.otpSentSuccess),
              });
            } else {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(authMocks.invalidOtp),
              });
            }
          },
        );
      });

      await test.step("2. Enter mobile and submit invalid 6-digit OTP", async () => {
        await signinPage.enterMobile("8595614105");
        await expect(signinPage.otpHeading).toBeVisible();
        await signinPage.enterOtp("000000");
      });

      await test.step("3. Assert inline error message is visible", async () => {
        await expect(signinPage.inlineError).toBeVisible();
        await expect(signinPage.inlineError).toContainText(/Invalid OTP/i);
      });
    });

    test("Existing user MPIN flow (Wrong then Right)", async ({ page }) => {
      let mpinAttempts = 0;

      await test.step("1. Setup multi-stage stateful mock for OTP and MPIN retries", async () => {
        await page.route(
          /\/api\/authentication\/customer-login/,
          async (route) => {
            const payload = route.request().postDataJSON() || {};

            if (!payload.otp && !payload.mpin) {
              // Stage 1: Send OTP
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(authMocks.otpSentSuccess),
              });
            } else if (payload.otp) {
              // Stage 2: Verify OTP -> return profile & transition to MPIN card
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(authMocks.loginSuccessExistingUser),
              });
            } else if (payload.mpin) {
              // Stage 3: MPIN submission (first wrong, then right)
              mpinAttempts++;
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(
                  mpinAttempts === 1
                    ? authMocks.invalidMpin
                    : authMocks.loginSuccessExistingUser,
                ),
              });
            }
          },
        );
      });

      await test.step("2. Progress through OTP verification to MPIN card", async () => {
        await signinPage.enterMobile("8595614105");
        await expect(signinPage.otpHeading).toBeVisible();
        await signinPage.enterOtp("123456");

        await expect(signinPage.mpinVerifyHeading).toBeVisible();
        await expect(page.getByText("Hi, Praveen!")).toBeVisible();
      });

      await test.step("3. Enter incorrect MPIN and assert inline error with focus reset", async () => {
        await signinPage.enterMpin("0000");
        await expect(signinPage.inlineError).toBeVisible();
        await expect(signinPage.mpinInputs.nth(0)).toBeFocused();
      });

      await test.step("4. Enter correct MPIN and assert dashboard redirect", async () => {
        await signinPage.enterMpin("1234");
        await page.waitForURL("**/lifegoal**");
        expect(page.url()).toContain("/lifegoal");
      });
    });

    test("New user MPIN setup flow to Onboarding", async ({ page }) => {
      await test.step("1. Mock new user response and MPIN creation endpoint", async () => {
        await page.route(
          /\/api\/authentication\/customer-login/,
          async (route) => {
            const payload = route.request().postDataJSON() || {};
            if (!payload.otp) {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(authMocks.otpSentSuccess),
              });
            } else {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(authMocks.loginSuccessNewUser),
              });
            }
          },
        );

        await page.route(/\/api\/authentication\/mpin-save/, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(authMocks.saveMpinSuccess),
          });
        });
      });

      await test.step("2. Complete OTP verification to trigger MPIN setup view", async () => {
        await signinPage.enterMobile("9999900000");
        await expect(signinPage.otpHeading).toBeVisible();
        await signinPage.enterOtp("123456");
      });

      const clickAction = async () => {
        const actionBtn = page.getByRole("button", {
          name: /continue|proceed|next|set mpin|submit/i,
        });
        if (await actionBtn.isVisible()) {
          await actionBtn.click();
        }
      };

      await test.step("3. Create initial MPIN and advance", async () => {
        await expect(signinPage.mpinSetupHeading).toHaveText(/Create/i);
        await signinPage.enterMpin("4321");
        await clickAction();
      });

      await test.step("4. Attempt confirmation with mismatched PIN and assert validation error", async () => {
        await expect(signinPage.mpinSetupHeading).toHaveText(/Confirm/i);
        await signinPage.enterMpin("1111");
        await clickAction();
        await expect(signinPage.inlineError).toHaveText(/match/i);
      });

      await test.step("5. Confirm matching MPIN and assert transition to onboarding", async () => {
        await signinPage.enterMpin("4321");
        await clickAction();

        await expect(
          page.getByRole("heading", { name: /Let's Get Started|Onboarding/i }),
        ).toBeVisible({ timeout: 10000 });
      });
    });
  });
});