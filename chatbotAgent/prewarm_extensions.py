"""Pre-warm macOS Gatekeeper/XProtect cache for all native Python extensions.

macOS scans ad-hoc-signed .so files via syspolicyd on first dlopen().
This script loads every .so in the venv to trigger the scan, so subsequent
imports are fast (~1ms instead of ~10s each).

Usage:
    python prewarm_extensions.py
"""
import ctypes
import glob
import os
import sys
import time

def main():
    venv = os.path.dirname(os.path.dirname(sys.executable))
    site_packages = os.path.join(venv, "lib", f"python{sys.version_info.major}.{sys.version_info.minor}", "site-packages")
    
    if not os.path.isdir(site_packages):
        print(f"site-packages not found at {site_packages}")
        return

    so_files = glob.glob(os.path.join(site_packages, "**", "*.so"), recursive=True)
    dylib_files = glob.glob(os.path.join(site_packages, "**", "*.dylib"), recursive=True)
    all_files = so_files + dylib_files
    
    print(f"Found {len(all_files)} native extensions to pre-warm")
    t0 = time.perf_counter()
    loaded = 0
    failed = 0
    
    for i, path in enumerate(all_files, 1):
        try:
            ctypes.CDLL(path)
            loaded += 1
        except OSError:
            failed += 1
        
        if i % 50 == 0 or i == len(all_files):
            elapsed = time.perf_counter() - t0
            print(f"  [{i}/{len(all_files)}] {elapsed:.1f}s elapsed", flush=True)
    
    elapsed = time.perf_counter() - t0
    print(f"\nDone: {loaded} loaded, {failed} failed (expected for some), {elapsed:.1f}s total")
    print("macOS notarization cache is now warm — subsequent Python imports will be fast.")

if __name__ == "__main__":
    main()
