# Pull Request: Fix Emoji Display Compatibility Across Platforms

## Summary
This PR addresses emoji rendering issues that prevent airport icons from displaying properly on macOS and other operating systems.

## Problem
- Airport icons (🏢, 🚁) and aircraft icons (✈️) were not displaying on macOS
- Users couldn't see or select airports due to missing visual indicators
- Font rendering differences between operating systems caused display issues

## Solution
- **Enhanced Font Support**: Added comprehensive emoji font family stack for cross-platform compatibility
- **Fallback Labels**: Added text labels (APT, HELI) that appear if emojis don't render
- **Improved Icon Rendering**: Updated both JavaScript and CSS for better emoji support

## Changes Made

### `js/main.js`
- Added emoji font family support for airport icons
- Included fallback text labels for airport types
- Enhanced aircraft and route marker icon rendering
- Added platform-specific emoji font stacks

### `css/main.css`
- Added emoji font family declarations for `.airport-icon` and `.aircraft-icon`
- Ensured consistent emoji rendering across different browsers and OS

## Testing
- ✅ Tested on macOS Safari, Chrome, Firefox
- ✅ Verified airport icons display with fallback text
- ✅ Confirmed aircraft and route markers render properly
- ✅ Ensured backward compatibility with Windows

## Benefits
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Accessibility**: Fallback text ensures airports are always visible
- **User Experience**: Users can now see and select airports regardless of emoji support
- **Future-Proof**: Robust font stack handles various emoji implementations

## Files Changed
- `js/main.js` - 15 lines modified, 6 lines added
- `css/main.css` - 2 lines added

## Screenshots
*[Add screenshots showing before/after emoji display]*

## Related Issues
- Fixes airport icon visibility on macOS
- Improves cross-platform compatibility
- Enhances user experience for airport selection
