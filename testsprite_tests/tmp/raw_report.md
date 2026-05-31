
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** DersRotası
- **Date:** 2026-05-31
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 Unlock the parent dashboard with the correct passcode
- **Test Code:** [TC001_Unlock_the_parent_dashboard_with_the_correct_passcode.py](./TC001_Unlock_the_parent_dashboard_with_the_correct_passcode.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/dbb95ad8-a42c-4200-a431-f6dbf05a83d4
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 Complete a child study session and see progress update
- **Test Code:** [TC002_Complete_a_child_study_session_and_see_progress_update.py](./TC002_Complete_a_child_study_session_and_see_progress_update.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/cdb4c8fe-a7dd-4eac-9c7f-bbeda5945586
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 Check off tasks in the daily study rota
- **Test Code:** [TC003_Check_off_tasks_in_the_daily_study_rota.py](./TC003_Check_off_tasks_in_the_daily_study_rota.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/bf163b31-b9f1-4d07-939d-fc7ae6f3b67a
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 Save a study log from the child dashboard
- **Test Code:** [TC004_Save_a_study_log_from_the_child_dashboard.py](./TC004_Save_a_study_log_from_the_child_dashboard.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/097d76ad-b604-41ce-9cf9-b55905d2e3e4
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005 Review the parent dashboard after unlocking access
- **Test Code:** [TC005_Review_the_parent_dashboard_after_unlocking_access.py](./TC005_Review_the_parent_dashboard_after_unlocking_access.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/d6ce57d4-421e-4cb3-a395-371e33015fb4
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006 Review syllabus tracking after completing curriculum tasks
- **Test Code:** [TC006_Review_syllabus_tracking_after_completing_curriculum_tasks.py](./TC006_Review_syllabus_tracking_after_completing_curriculum_tasks.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/9fcef489-4b2d-44ab-a080-b34c604183a3
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 Review completion correctness and duration analytics
- **Test Code:** [TC007_Review_completion_correctness_and_duration_analytics.py](./TC007_Review_completion_correctness_and_duration_analytics.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/c79bfa13-eb88-47b6-8344-5b2cd121319e
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 Recalculate the study rota and review updated suggestions
- **Test Code:** [TC008_Recalculate_the_study_rota_and_review_updated_suggestions.py](./TC008_Recalculate_the_study_rota_and_review_updated_suggestions.py)
- **Test Error:** TEST FAILURE

Updated study rota suggestions did not appear after recalculation.

Observations:
- A green banner 'Planlama ve ders rotası başarıyla yeniden hesaplandı.' was displayed after clicking 'Yeniden Hesapla'.
- 'Planı gör' (detailed plan) was opened but on-page searches for suggestion keywords ('Öner', 'Öneri', 'Önerilen', 'Günlük akış') returned no matches and no suggestion UI was visible.
- The daily summary indicated no items for today (the plan shows no suggested items for the current day).

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/c9963cab-70b1-4089-a5c5-d527a71f1eef
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 Adjust the daily curriculum load and confirm the revised plan
- **Test Code:** [TC009_Adjust_the_daily_curriculum_load_and_confirm_the_revised_plan.py](./TC009_Adjust_the_daily_curriculum_load_and_confirm_the_revised_plan.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/5c7233aa-ea62-4b45-84c3-d18770c67039
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010 Compare subject performance distribution
- **Test Code:** [TC010_Compare_subject_performance_distribution.py](./TC010_Compare_subject_performance_distribution.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/5130d8e6-cd42-40e9-9cb0-d3f4038683b8
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC011 Review academic risk signals and performance consistency
- **Test Code:** [TC011_Review_academic_risk_signals_and_performance_consistency.py](./TC011_Review_academic_risk_signals_and_performance_consistency.py)
- **Test Error:** Test execution failed or timed out
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/e848ed65-7211-4bd5-a3d2-cf77c10b6fb7
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC012 Use risk signals to revise the study plan
- **Test Code:** [TC012_Use_risk_signals_to_revise_the_study_plan.py](./TC012_Use_risk_signals_to_revise_the_study_plan.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/f0ecc74a-69f3-42f1-8059-a2cc29d04b30
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC013 Adjust the daily curriculum load after reviewing analytics
- **Test Code:** [TC013_Adjust_the_daily_curriculum_load_after_reviewing_analytics.py](./TC013_Adjust_the_daily_curriculum_load_after_reviewing_analytics.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/42355465-c1a4-4e2d-abba-3289bb5073a3
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC014 Review the recalculated schedule after changing curriculum pacing
- **Test Code:** [TC014_Review_the_recalculated_schedule_after_changing_curriculum_pacing.py](./TC014_Review_the_recalculated_schedule_after_changing_curriculum_pacing.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/54107701-9b2b-43ff-b82a-713e069c5aa8
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015 Recalculate the rota and review updated planning suggestions
- **Test Code:** [TC015_Recalculate_the_rota_and_review_updated_planning_suggestions.py](./TC015_Recalculate_the_rota_and_review_updated_planning_suggestions.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/32a5c179-b3e0-4774-95f2-3aba91cd9f7b/384dbf1d-2a14-4f39-94b6-64830f4fdb15
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **86.67** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---