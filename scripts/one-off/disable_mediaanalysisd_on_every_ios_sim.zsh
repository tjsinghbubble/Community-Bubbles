#!/bin/zsh
#
# This is a quick script to fix all the existing iOS simulators
# it takes optional arguments of the UDID values that should be targeted.

indexing_daemons=(mediaanalysisd intelligenceplatformd suggestd routined assistantd)
set -x

# use this when you want the time... but you really want the elapsed time more.
# prints like "elapsed 44s     20:14:53: <your $* text here>"
# and continues to keep track of how long ago it was last invoked.
# FIXME: as written, cannot work in same shell with other invocations of lg()
_last_lg_epoch='0'
function lg() {
    if [[ "${_last_lg_epoch}" -gt 0 ]] ; then
        now_epoch=$(date +"%s")
        diff_secs=$(( "${now_epoch}" - "${_last_lg_epoch}" ))
        : this convoluted way is to get the tab to expand
        print $( date +"elapsed ${diff_secs}s\t%T: $*" )
    else
        print $( date +"\t\t%T: $*" )
    fi
    _last_lg_epoch=$(date +"%s")
}

function wait_until_load_below() {
    max_tolerable_load="$1"
    if [[ -z "${load}" ]] ; then
        max_tolerable_load=20
    fi
    now_in_epoch=$(date +"%s")
    stoptime_in_epoch=(( $now_in_epoch + 300 ))
    while [[ ${now_in_epoch} -lt ${stoptime_in_epoch} ]]; do
        current_1min_load = $( uptime | awk '{ print $10}' )
        if [[ "${current_1min_load}" -lt "${max_tolerable_load}" ]] ; then
            return 0
        fi
    done
}


if [[ -z "$1" ]]
then
    # no iOS simulators were specified -- get them all.
    # ignore any real devices. sort UDIDs so they are in a stable
    # order in case of interruption.
    print -u2 "Obtaining iOS UDID values"
    device_list=(${(f)"$(manage_devices --ios --list --simulated --verbose | awk '/UDID/ {print $2}' | sort)"})
else
    # user-specified list
    device_list=("$@")
fi

if (( ${#device_list} == 0 ))
then
    print -u2 "Error: No iOS devices found or specified."
    exit 1
fi
print -u2 "Targeting these simulators: ${device_list}"


# nuke everything just to be safe
print -u2 "Going to kill EVERY simulator or emulator in five (5) seconds! Unless you stop this script!!"
sleep 5
manage_devices --kill all

# iterate through ios simulators. the start command will wait until the device is fully booted.
#
print -u2 "Warning: Going to boot and update ${#device_list} iOS simulators in sequence. This will take a while."

lg "Starting loop"
for sim in "${device_list[@]}"
do
    lg "Sim $sim starting"
    manage_devices --start "${sim}"
    lg "Sim $sim fully booted."
    for daemon in ${indexing_daemons} ; do
        lg "Disabling ${daemon}."
        xcrun simctl spawn "${sim}" launchctl disable "system/com.apple.${daemon}"
    done

    # no per-daemon kill needed: shutting the simulator down takes every
    # daemon with it, and the disable prevents relaunch on next boot.
    lg "Daemons disabled. Now killing simulator ${sim} itself."
    manage_devices --kill "${sim}"

    lg "Done with $sim\n"
done

lg "Done with main loop"

exit 0
