#!/usr/bin/env python3
"""
Dependency checker for Aerofly Moving Map
This script checks if all required Python packages are installed.
"""

import importlib
import sys

def check_package(package_name, import_name=None):
    """Check if a package is installed and importable."""
    if import_name is None:
        import_name = package_name
    
    try:
        importlib.import_module(import_name)
        print(f"✅ {package_name} - OK")
        return True
    except ImportError:
        print(f"❌ {package_name} - NOT FOUND")
        return False

def main():
    print("Checking Python dependencies for Aerofly Moving Map...")
    print("=" * 50)
    
    required_packages = [
        ("websockets", "websockets"),
        ("asyncio", "asyncio"),
        ("socket", "socket"),
        ("json", "json"),
        ("time", "time"),
        ("os", "os"),
    ]
    
    missing_packages = []
    
    for package_name, import_name in required_packages:
        if not check_package(package_name, import_name):
            missing_packages.append(package_name)
    
    print("=" * 50)
    
    if missing_packages:
        print(f"\n❌ Missing packages: {', '.join(missing_packages)}")
        print("\nTo install missing packages, run:")
        print("pip3 install websockets")
        print("\nNote: asyncio, socket, json, time, and os are built-in modules.")
    else:
        print("\n✅ All required packages are installed!")
        print("\nYou can now run the application with:")
        print("./start_aerofly_map.sh")
    
    # Check Python version
    print(f"\nPython version: {sys.version}")
    if sys.version_info < (3, 7):
        print("⚠️  Warning: Python 3.7 or higher is recommended for asyncio features.")

if __name__ == "__main__":
    main()
