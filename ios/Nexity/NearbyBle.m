#import <React/RCTEventEmitter.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import <UIKit/UIKit.h>

static NSString *const kServiceUUID = @"6E657869-7479-4E65-6172-627900000001";
static NSString *const kShortUUID = @"0000FFF0-0000-1000-8000-00805F9B34FB";
static NSString *const kCharUUID = @"6E657869-7479-4E65-6172-627900000002";

@interface NearbyBle : RCTEventEmitter <CBPeripheralManagerDelegate, CBCentralManagerDelegate, CBPeripheralDelegate>
@end

@implementation NearbyBle {
  CBPeripheralManager *_peripheral;
  CBCentralManager *_central;
  CBMutableCharacteristic *_characteristic;
  NSData *_eph;
  BOOL _scanning;
  BOOL _serviceAdded;
  NSMutableSet<NSString *> *_reading;
  NSMutableDictionary<NSString *, CBPeripheral *> *_found;
  NSMutableDictionary<NSString *, NSNumber *> *_rssi;
  NSMutableDictionary<NSString *, NSNumber *> *_retries;
  NSMutableArray<RCTPromiseResolveBlock> *_stateWaiters;
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE(NearbyBle);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ @"NearbyBleSighting" ];
}

- (void)startObserving
{
  _hasListeners = YES;
}

- (void)stopObserving
{
  _hasListeners = NO;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (CBCentralManager *)central
{
  if (_central == nil) {
    _central = [[CBCentralManager alloc] initWithDelegate:self
                                                     queue:dispatch_get_main_queue()
                                                   options:@{CBCentralManagerOptionShowPowerAlertKey : @NO}];
  }
  return _central;
}

- (CBPeripheralManager *)peripheral
{
  if (_peripheral == nil) {
    _peripheral = [[CBPeripheralManager alloc] initWithDelegate:self
                                                           queue:dispatch_get_main_queue()
                                                         options:@{CBPeripheralManagerOptionShowPowerAlertKey : @NO}];
  }
  return _peripheral;
}

- (BOOL)radioKnown
{
  return self.central.state != CBManagerStateUnknown && self.central.state != CBManagerStateResetting &&
         self.peripheral.state != CBManagerStateUnknown && self.peripheral.state != CBManagerStateResetting;
}

- (BOOL)radioOn
{
  return self.central.state == CBManagerStatePoweredOn && self.peripheral.state == CBManagerStatePoweredOn;
}

- (BOOL)radioMissing
{
  return self.central.state == CBManagerStateUnsupported || self.peripheral.state == CBManagerStateUnsupported;
}

- (void)flushStateWaiters
{
  if (![self radioKnown] || _stateWaiters.count == 0) return;
  NSArray<RCTPromiseResolveBlock> *waiters = [_stateWaiters copy];
  [_stateWaiters removeAllObjects];
  BOOL on = [self radioOn];
  for (RCTPromiseResolveBlock resolve in waiters) {
    resolve(@(on));
  }
}

- (void)waitForRadio:(RCTPromiseResolveBlock)resolve
{
  if ([self radioKnown]) {
    resolve(@([self radioOn]));
    return;
  }
  if (_stateWaiters == nil) _stateWaiters = [NSMutableArray array];
  __block BOOL done = NO;
  RCTPromiseResolveBlock once = ^(id result) {
    if (done) return;
    done = YES;
    resolve(result);
  };
  [_stateWaiters addObject:once];
  __weak NearbyBle *weakSelf = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(4 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    NearbyBle *self_ = weakSelf;
    if (self_ == nil || done) return;
    [self_->_stateWaiters removeObject:once];
    once(@([self_ radioOn]));
  });
}

RCT_EXPORT_METHOD(supported : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  (void)self.central;
  (void)self.peripheral;
  if ([self radioKnown]) {
    resolve(@(![self radioMissing]));
    return;
  }
  [self waitForRadio:^(id result) {
    resolve(@(![self radioMissing]));
  }];
}

RCT_EXPORT_METHOD(adapterOn : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  (void)self.central;
  (void)self.peripheral;
  [self waitForRadio:resolve];
}

RCT_EXPORT_METHOD(requestEnable : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  // iOS does not allow an app to turn Bluetooth on. Settings is the supported path.
  [[UIApplication sharedApplication] openURL:[NSURL URLWithString:UIApplicationOpenSettingsURLString]
                                     options:@{}
                           completionHandler:nil];
  resolve(@YES);
}

RCT_EXPORT_METHOD(start : (NSString *)ephId resolver : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  NSData *bytes = [self decode:ephId];
  if (bytes.length != 16) {
    resolve(@NO);
    return;
  }
  (void)self.central;
  (void)self.peripheral;
  [self waitForRadio:^(id result) {
    if (![self radioOn]) {
      resolve(@NO);
      return;
    }
    [self stopInternal];
    _eph = bytes;
    _reading = [NSMutableSet set];
    _found = [NSMutableDictionary dictionary];
    _rssi = [NSMutableDictionary dictionary];
    _retries = [NSMutableDictionary dictionary];
    _scanning = YES;
    _serviceAdded = NO;
    [self publish];
    [self.central scanForPeripheralsWithServices:@[
      [CBUUID UUIDWithString:kShortUUID],
      [CBUUID UUIDWithString:kServiceUUID],
    ]
                                         options:@{CBCentralManagerScanOptionAllowDuplicatesKey : @YES}];
    resolve(@YES);
  }];
}

RCT_EXPORT_METHOD(updateId : (NSString *)ephId resolver : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  NSData *bytes = [self decode:ephId];
  if (bytes.length != 16) {
    resolve(@NO);
    return;
  }
  if (!_scanning) {
    [self start:ephId resolver:resolve rejecter:reject];
    return;
  }
  _eph = bytes;
  resolve(@YES);
}

RCT_EXPORT_METHOD(stop : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  [self stopInternal];
  resolve(@YES);
}

- (void)publish
{
  if (!_scanning || self.peripheral.state != CBManagerStatePoweredOn) return;
  [_peripheral stopAdvertising];
  CBMutableCharacteristic *ch = [[CBMutableCharacteristic alloc] initWithType:[CBUUID UUIDWithString:kCharUUID]
                                                                    properties:CBCharacteristicPropertyRead
                                                                         value:nil
                                                                   permissions:CBAttributePermissionsReadable];
  _characteristic = ch;
  CBMutableService *service = [[CBMutableService alloc] initWithType:[CBUUID UUIDWithString:kServiceUUID] primary:YES];
  service.characteristics = @[ ch ];
  [_peripheral removeAllServices];
  _serviceAdded = NO;
  [_peripheral addService:service];
}

- (void)stopInternal
{
  if (_central != nil && _scanning) [_central stopScan];
  for (CBPeripheral *peripheral in _found.allValues) {
    [_central cancelPeripheralConnection:peripheral];
  }
  [_peripheral stopAdvertising];
  if (_peripheral != nil) [_peripheral removeAllServices];
  _scanning = NO;
  _serviceAdded = NO;
  _eph = nil;
  _characteristic = nil;
  [_reading removeAllObjects];
  [_found removeAllObjects];
  [_rssi removeAllObjects];
  [_retries removeAllObjects];
}

- (void)emit:(NSData *)bytes rssi:(NSNumber *)rssi
{
  if (!_hasListeners || bytes.length != 16) return;
  if (_eph != nil && [bytes isEqualToData:_eph]) return;
  NSString *encoded = [self encode:bytes];
  static NSMutableDictionary<NSString *, NSNumber *> *lastEmit;
  if (lastEmit == nil) lastEmit = [NSMutableDictionary dictionary];
  NSTimeInterval now = [NSDate timeIntervalSinceReferenceDate];
  NSNumber *previous = lastEmit[encoded];
  if (previous != nil && now - previous.doubleValue < 1.0) return;
  lastEmit[encoded] = @(now);
  [self sendEventWithName:@"NearbyBleSighting" body:@{@"ephId" : encoded, @"rssi" : rssi ?: @(-70)}];
}

- (void)forget:(CBPeripheral *)peripheral
{
  NSString *key = peripheral.identifier.UUIDString;
  [_found removeObjectForKey:key];
  [_reading removeObject:key];
  [_rssi removeObjectForKey:key];
  if (_central != nil) [_central cancelPeripheralConnection:peripheral];
}

#pragma mark - Peripheral

- (void)peripheralManager:(CBPeripheralManager *)peripheral didAddService:(CBService *)service error:(NSError *)error
{
  if (!_scanning || error != nil) return;
  _serviceAdded = YES;
  if (peripheral.state == CBManagerStatePoweredOn && !peripheral.isAdvertising) {
    NSMutableDictionary *advert = [@{
      CBAdvertisementDataServiceUUIDsKey : @[ [CBUUID UUIDWithString:kShortUUID] ],
    } mutableCopy];
    NSString *name = [self encode:_eph];
    if (name.length > 0) advert[CBAdvertisementDataLocalNameKey] = name;
    [peripheral startAdvertising:advert];
  }
}

- (void)peripheralManager:(CBPeripheralManager *)peripheral didReceiveReadRequest:(CBATTRequest *)request
{
  if (_eph == nil || request.offset > _eph.length) {
    [peripheral respondToRequest:request withResult:CBATTErrorInvalidOffset];
    return;
  }
  request.value = [_eph subdataWithRange:NSMakeRange(request.offset, _eph.length - request.offset)];
  [peripheral respondToRequest:request withResult:CBATTErrorSuccess];
}

- (void)peripheralManagerDidUpdateState:(CBPeripheralManager *)peripheral
{
  BOOL waiting = _stateWaiters.count > 0 && [self radioKnown];
  [self flushStateWaiters];
  if (!waiting && peripheral.state == CBManagerStatePoweredOn && _scanning && !_serviceAdded) {
    [self publish];
  }
  if (peripheral.state != CBManagerStatePoweredOn && _scanning) {
    [peripheral stopAdvertising];
    _serviceAdded = NO;
  }
}

#pragma mark - Central

- (void)centralManagerDidUpdateState:(CBCentralManager *)central
{
  BOOL waiting = _stateWaiters.count > 0 && [self radioKnown];
  [self flushStateWaiters];
  if (!waiting && central.state == CBManagerStatePoweredOn && _scanning) {
    [central scanForPeripheralsWithServices:@[
      [CBUUID UUIDWithString:kShortUUID],
      [CBUUID UUIDWithString:kServiceUUID],
    ]
                                    options:@{CBCentralManagerScanOptionAllowDuplicatesKey : @YES}];
  }
  if (central.state != CBManagerStatePoweredOn && _scanning) {
    [central stopScan];
  }
}

- (NSData *)payloadFromAdvertisement:(NSDictionary *)advertisementData
{
  NSDictionary *serviceData = advertisementData[CBAdvertisementDataServiceDataKey];
  NSData *inlineData = serviceData[[CBUUID UUIDWithString:kShortUUID]];
  if (inlineData.length == 16) return inlineData;
  NSData *maker = advertisementData[CBAdvertisementDataManufacturerDataKey];
  if (maker.length == 18) {
    uint16_t company = 0;
    [maker getBytes:&company length:sizeof(company)];
    if (company == 0x4E58) return [maker subdataWithRange:NSMakeRange(2, 16)];
  }
  NSString *name = advertisementData[CBAdvertisementDataLocalNameKey];
  if ([name isKindOfClass:[NSString class]]) {
    NSData *named = [self decode:name];
    if (named.length == 16) return named;
  }
  return nil;
}

- (void)centralManager:(CBCentralManager *)central didDiscoverPeripheral:(CBPeripheral *)peripheral advertisementData:(NSDictionary *)advertisementData RSSI:(NSNumber *)RSSI
{
  NSData *inlineData = [self payloadFromAdvertisement:advertisementData];
  if (inlineData.length == 16) {
    [self emit:inlineData rssi:RSSI ?: @(-70)];
    return;
  }
}

- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral
{
  [peripheral discoverServices:@[ [CBUUID UUIDWithString:kServiceUUID] ]];
}

- (void)centralManager:(CBCentralManager *)central didFailToConnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
  NSString *key = peripheral.identifier.UUIDString;
  NSInteger tries = _retries[key].integerValue;
  if (tries < 2 && _scanning) {
    _retries[key] = @(tries + 1);
    [central connectPeripheral:peripheral options:nil];
    return;
  }
  [self forget:peripheral];
}

- (void)centralManager:(CBCentralManager *)central didDisconnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
  NSString *key = peripheral.identifier.UUIDString;
  [_found removeObjectForKey:key];
  [_reading removeObject:key];
}

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverServices:(NSError *)error
{
  CBService *service = nil;
  for (CBService *candidate in peripheral.services) {
    if ([candidate.UUID isEqual:[CBUUID UUIDWithString:kServiceUUID]]) service = candidate;
  }
  if (service == nil) {
    [self forget:peripheral];
    return;
  }
  [peripheral discoverCharacteristics:@[ [CBUUID UUIDWithString:kCharUUID] ] forService:service];
}

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverCharacteristicsForService:(CBService *)service error:(NSError *)error
{
  CBCharacteristic *ch = nil;
  for (CBCharacteristic *candidate in service.characteristics) {
    if ([candidate.UUID isEqual:[CBUUID UUIDWithString:kCharUUID]]) ch = candidate;
  }
  if (ch == nil) {
    [self forget:peripheral];
    return;
  }
  [peripheral readValueForCharacteristic:ch];
}

- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
  NSString *key = peripheral.identifier.UUIDString;
  if (error == nil) [self emit:characteristic.value rssi:_rssi[key]];
  [self forget:peripheral];
}

- (NSData *)decode:(NSString *)ephId
{
  if (ephId.length == 0) return nil;
  NSString *b64 = [[ephId stringByReplacingOccurrencesOfString:@"-" withString:@"+"] stringByReplacingOccurrencesOfString:@"_" withString:@"/"];
  NSUInteger pad = (4 - (b64.length % 4)) % 4;
  b64 = [b64 stringByPaddingToLength:b64.length + pad withString:@"=" startingAtIndex:0];
  return [[NSData alloc] initWithBase64EncodedString:b64 options:0];
}

- (NSString *)encode:(NSData *)data
{
  NSString *b64 = [data base64EncodedStringWithOptions:0];
  b64 = [[[b64 stringByReplacingOccurrencesOfString:@"+" withString:@"-"] stringByReplacingOccurrencesOfString:@"/" withString:@"_"] stringByReplacingOccurrencesOfString:@"=" withString:@""];
  return b64;
}

@end
