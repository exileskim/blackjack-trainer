import { expect, test, type Page } from '@playwright/test'

async function launchTraining(page: Page, mode: 'playAndCount' | 'countingDrill') {
  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto('/blackjack-trainer/')
  await expect(page.getByRole('button', { name: /Begin Training/i })).toBeVisible()

  if (mode === 'playAndCount') {
    await page.getByRole('button', { name: /^Play \+ Count/i }).click()
  } else {
    await page.getByRole('button', { name: /^Counting Drill/i }).click()
  }

  await page.getByRole('button', { name: /^Begin Training/i }).click()

  await expect(
    page.getByRole('main', { name: /Blackjack training table/i }),
  ).toBeVisible()

  if (mode === 'countingDrill') {
    const speedButton = page.getByRole('button', { name: /↑↓/ })
    await speedButton.click()
    await speedButton.click()
  }
}

async function clearCountPromptIfOpen(page: Page): Promise<boolean> {
  const dialog = page.getByRole('dialog')
  if (!(await dialog.isVisible())) return false

  const input = page.getByRole('textbox', { name: /Running count/i })
  if (await input.isVisible()) {
    await input.fill('0')
    await page.getByRole('button', { name: /Submit/i }).click()
  }

  const continueButton = page.getByRole('button', { name: /Continue/i })
  if (await continueButton.isVisible()) {
    await continueButton.click()
  }

  return true
}

test('player can actively control hands with Hit and Stand', async ({ page }) => {
  await launchTraining(page, 'playAndCount')

  let usedHit = false
  let usedStand = false
  let handsAdvanced = 0
  let guard = 0

  while (handsAdvanced < 8 && guard < 500) {
    guard++

    if (await clearCountPromptIfOpen(page)) continue

    const nextHandButton = page.getByRole('button', { name: /Next Hand/i })
    if (await nextHandButton.isVisible()) {
      await nextHandButton.click()
      handsAdvanced++
      continue
    }

    const hitButton = page.getByRole('button', { name: /^Hit/i })
    const standButton = page.getByRole('button', { name: /^(Stand|Hold)/i })
    if (!usedHit && (await hitButton.isVisible())) {
      await hitButton.click()
      usedHit = true
      continue
    }

    if (await standButton.isVisible()) {
      await standButton.click()
      usedStand = true
      continue
    }

    if (await hitButton.isVisible()) {
      if (!usedHit) {
        await hitButton.click()
        usedHit = true
      }
      continue
    }

    await page.waitForTimeout(50)
  }

  expect(usedHit).toBe(true)
  expect(usedStand).toBe(true)
  expect(handsAdvanced).toBeGreaterThan(0)

  while (await clearCountPromptIfOpen(page)) {
    // Exhaust pending prompt stages before ending.
  }
  await page.getByRole('button', { name: /End Session/i }).click()
  await expect(page.getByRole('heading', { name: /Summary/i })).toBeVisible()
})

test('count prompts respect adaptive cadence boundaries', async ({ page }) => {
  await launchTraining(page, 'countingDrill')

  const promptHands: number[] = []
  let guard = 0

  while (promptHands.length < 5 && guard < 1600) {
    guard++

    const dialog = page.getByRole('dialog')
    if (await dialog.isVisible()) {
      const input = page.getByRole('textbox', { name: /Running count/i })
      if (await input.isVisible()) {
        const handLabel = await dialog.getByText(/Hand #\d+/).innerText()
        const handNumber = Number(handLabel.replace(/[^0-9]/g, ''))
        const last = promptHands[promptHands.length - 1]
        if (handNumber && handNumber !== last) {
          promptHands.push(handNumber)
        }
        await input.fill('0')
        await page.getByRole('button', { name: /Submit/i }).click()
      } else {
        const continueButton = page.getByRole('button', { name: /Continue/i })
        if (await continueButton.isVisible()) {
          await continueButton.click()
        }
      }
      continue
    }

    await page.waitForTimeout(50)
  }

  expect(promptHands.length).toBeGreaterThanOrEqual(5)
  expect([4, 5]).toContain(promptHands[0]!)
  for (let i = 1; i < promptHands.length; i++) {
    const delta = promptHands[i]! - promptHands[i - 1]!
    expect([2, 3, 4, 5]).toContain(delta)
  }
})

test('long-run reliability (configurable duration)', async ({ page }) => {
  test.skip(
    process.env.RUN_LONG_RELIABILITY !== '1',
    'Set RUN_LONG_RELIABILITY=1 to run long reliability validation.',
  )

  const durationMs = Number(process.env.RELIABILITY_DURATION_MS ?? '1800000')
  await launchTraining(page, 'countingDrill')

  const deadline = Date.now() + durationMs
  let interactions = 0

  while (Date.now() < deadline) {
    if (await clearCountPromptIfOpen(page)) {
      interactions++
      continue
    }

    const nextHandButton = page.getByRole('button', { name: /Next Hand/i })
    if (await nextHandButton.isVisible()) {
      await nextHandButton.click()
      interactions++
      continue
    }

    await page.waitForTimeout(50)
  }

  while (await clearCountPromptIfOpen(page)) {
    interactions++
  }

  await page.getByRole('button', { name: /End Session/i }).click()
  await expect(page.getByRole('heading', { name: /Summary/i })).toBeVisible()
  expect(interactions).toBeGreaterThan(20)
})
