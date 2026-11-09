#!/usr/bin/env python3
import time

# Safe CPU pulse for 35 seconds to prevent Oracle Cloud Always Free 7-day idle reclamation
end_time = time.time() + 35
while time.time() < end_time:
    _ = [x * x for x in range(10000)]
    time.sleep(0.01) # gentle pacing: ~25-30% CPU, 0 RAM overhead
