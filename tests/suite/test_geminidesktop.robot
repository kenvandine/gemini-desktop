*** Settings ***
Documentation    Test cases for gemini-desktop snap
Resource         kvm.resource


*** Test Cases ***
Gemini Desktop Launches And Renders
    [Documentation]    Verify gemini-desktop snap launches and renders a UI on Mir
    [Tags]    smoke    yarf:certification_status: blocker
    Log Screenshot
