#!/bin/bash
#
# Script to install GRR from scratch on an Ubuntu system. Tested on trusty
# (14.04)
#
# By default this will install into /usr and set the config in
# /etc/grr/
#
PREFIX=/usr

# If true, do an apt-get upgrade
: ${UPGRADE:=true}

# Variables to control the install versions etc. Made for changing this to
# support other platforms more easily.
PLAT=amd64
INSTALL_DIR=${PREFIX}/share/grr

GRR_STABLE_VERSION=0.3.0-7
GRR_TEST_VERSION=
SERVER_DEB_STABLE_BASE_URL=https://googledrive.com/host/0B1wsLqFoT7i2c3F0ZmI1RDJlUEU/grr-server_
SERVER_DEB_TEST_BASE_URL=https://googledrive.com/host/0B1wsLqFoT7i2c3F0ZmI1RDJlUEU/test-grr-server_

if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

# Variable to store if the user has answered "Yes to All"
ALL_YES=0;

# If true only install build dependencies. GRR itself and the database won't be
# installed.
BUILD_DEPS_ONLY=0;

# Use local deb, for testing
GRR_LOCAL_TEST=0

# Use the GRR test version
GRR_TESTING=0;

OPTIND=1
while getopts "h?ltdy" opt; do
    case "$opt" in
    h|\?)
        echo "Usage: ./install_script_ubuntu.sh [OPTIONS]"
        echo " -l Test locally (no download), get deb from current path"
        echo " -t Install the GRR beta testing version"
        echo " -d Only install build dependencies"
        echo " -y Don't prompt, i.e. answer yes to everything"
        exit 0
        ;;
    l)  GRR_LOCAL_TEST=1
        ;;
    t)  GRR_TESTING=1;
        ;;
    d)  BUILD_DEPS_ONLY=1;
        ;;
    y)  ALL_YES=1;
        ;;
    esac
done

shift $((OPTIND-1))
[ "$1" = "--" ] && shift

echo "Running with GRR_LOCAL_TEST=${GRR_LOCAL_TEST}, GRR_TESTING=${GRR_TESTING}, BUILD_DEPS_ONLY=${BUILD_DEPS_ONLY}, ALL_YES=${ALL_YES}"

if [ ${GRR_TESTING} = 0 ];
then
  SERVER_DEB_URL=${SERVER_DEB_STABLE_BASE_URL}${GRR_STABLE_VERSION}_${PLAT}.deb
else
  echo "#########################################"
  echo "#### Running with Beta test versions ####"
  echo "#########################################"
  SERVER_DEB_URL=${SERVER_DEB_TEST_BASE_URL}${GRR_TEST_VERSION}_${PLAT}.deb
fi

function header()
{
  echo ""
  echo "##########################################################################################"
  echo "     ${*}";
  echo "##########################################################################################"
}

function run_header()
{
  echo "#### Running #### ${*}"
}


function exit_fail()
{
  FAIL=$*;
  echo "#########################################################################################";
  echo "FAILURE RUNNING: ${FAIL}";
  echo "#########################################################################################";
  exit 0
}


function run_cmd_confirm()
{
  CMD=$*;
  if [ ${ALL_YES} = 0 ]; then
    echo ""
    read -p "Run ${CMD} [Y/n/a]? " REPLY
    case $REPLY in
      y|Y|'') run_header ${CMD};;
      a|A) echo "Answering yes from now on"; ALL_YES=1;;
      *) return ;;
    esac
  fi
  ${CMD};
  RETVAL=$?
  if [ $RETVAL -ne 0 ]; then
    exit_fail $CMD;
  fi
};

header "Adding launchpad.net/~gift PPA for m2crypto pytsk dependencies."
run_cmd_confirm apt-get install -y software-properties-common
run_cmd_confirm add-apt-repository ppa:gift/dev -y
run_cmd_confirm apt-get update -q

header "Updating APT and Installing dependencies"
run_cmd_confirm apt-get --yes update;
if $UPGRADE; then
  run_cmd_confirm apt-get --yes upgrade;
fi

header "Installing dependencies."
# Installing pkg-config is a workaround for this matplotlib problem:
# https://github.com/matplotlib/matplotlib/issues/3029/
sudo apt-get install -y \
  apache2-utils \
  build-essential \
  debhelper \
  dpkg-dev \
  git-core \
  ipython \
  libdistorm64-dev \
  libdistorm64-1 \
  libfreetype6-dev \
  libpng-dev \
  libprotobuf-dev \
  ncurses-dev \
  pkg-config \
  prelink \
  protobuf-compiler \
  python-m2crypto \
  python-protobuf \
  python-setuptools \
  python-support \
  pytsk3 \
  rpm \
  sleuthkit \
  swig \
  wget \
  zip

# Fail silently if python-dev or libpython-dev is not available in the apt repo
# python-dev is for Ubuntu version < 12.10 and libpython-dev is for > 12.04
apt-get --force-yes --yes install python-dev 2>/dev/null
apt-get --force-yes --yes install libpython-dev 2>/dev/null

run_cmd_confirm wget --quiet https://bootstrap.pypa.io/get-pip.py
run_cmd_confirm python get-pip.py
run_cmd_confirm pip install pip --upgrade

header "Installing python dependencies"
run_cmd_confirm wget --quiet https://raw.githubusercontent.com/google/grr/93cd1fd0cd1ca05e526af86ef33a996216273c8e/requirements.txt
run_cmd_confirm pip install -r requirements.txt

# Set filehandle max to a high value if it isn't already set.
if ! grep -Fq "fs.file-max" /etc/sysctl.conf; then
  header "Increase our filehandle limit (for SQLite datastore)."
  echo "fs.file-max = 1048576" >> /etc/sysctl.conf
  sysctl -p
fi
echo "Filehandle limit now: $(cat /proc/sys/fs/file-max)"

if [ $BUILD_DEPS_ONLY = 1 ]; then
  echo "#######################################"
  echo "Finished installing build dependencies."
  echo "#######################################"
  exit 0
fi

header "Installing GRR from prebuilt package"
SERVER_DEB=$(basename ${SERVER_DEB_URL});
if [ $GRR_LOCAL_TEST = 0 ]; then
  run_cmd_confirm wget --no-verbose ${SERVER_DEB_URL} -O ${SERVER_DEB};
  run_cmd_confirm dpkg -i ${SERVER_DEB};
else
  run_cmd_confirm dpkg -i ${SERVER_DEB};
fi

header "Initialize the configuration, building clients and setting options."
run_cmd_confirm grr_config_updater initialize

header "Enable grr services to start automatically on boot"
run_cmd_confirm . /usr/share/grr/scripts/shell_helpers.sh
run_cmd_confirm enable_services grr-http-server
run_cmd_confirm enable_services grr-ui
run_cmd_confirm enable_services grr-worker

HOSTNAME=`hostname`
header "Install complete. Congratulations. Point your browser at http://${HOSTNAME}:8000"
